import { EmailMessage } from 'cloudflare:email';

// Field list, labels and "required" come from the live site's data/apply.json,
// so editing the form there (or in the CMS) needs no change here.
const MB = 1024 * 1024;
const FILE_RULES = {
  cv: { max: 10 * MB, exts: ['pdf', 'doc', 'docx'] },
  photo: { max: 5 * MB, exts: ['jpg', 'jpeg', 'png', 'webp', 'heic'] },
};
const OTHER_FILE = { max: 10 * MB, exts: [...FILE_RULES.cv.exts, ...FILE_RULES.photo.exts] };
const MAX_TOTAL = 15 * MB; // keeps each email under the 25 MB mail limit after base64

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGINS.split(',');
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    const json = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST' || new URL(req.url).pathname !== '/apply') return json(404, { error: 'Not found.' });
    if (!allowed.includes(origin)) return json(403, { error: 'Applications are only accepted from the fellowship website.' });

    let form;
    try { form = await req.formData(); } catch { return json(400, { error: 'The form could not be read.' }); }
    if (form.get('website')) return json(200, { ok: true, reference: 'received' }); // honeypot: bots get a fake success

    const cfg = await fetch(`${env.SITE}/data/apply.json`, { cf: { cacheTtl: 300 } })
      .then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!cfg) return json(503, { error: 'The application service is temporarily unavailable.' });
    if (!cfg.applicationsOpen) return json(403, { error: 'Applications are currently closed.' });

    const answers = [];
    const files = [];
    let total = 0;
    for (const f of cfg.fields.filter(f => f.enabled !== false)) {
      const v = form.get(f.name);
      if (f.type === 'file') {
        if (!(v && typeof v === 'object' && v.size > 0)) {
          if (f.required) return json(400, { error: `Please attach: ${f.label}.` });
          continue;
        }
        const rule = FILE_RULES[f.name] || OTHER_FILE;
        const ext = (v.name.split('.').pop() || '').toLowerCase();
        if (!rule.exts.includes(ext)) return json(400, { error: `${f.label}: allowed file types are ${rule.exts.join(', ')}.` });
        if (v.size > rule.max) return json(400, { error: `${f.label} is larger than ${rule.max / MB} MB.` });
        total += v.size;
        files.push({ field: f.name, ext, type: v.type || 'application/octet-stream', data: await v.arrayBuffer() });
      } else if (f.type === 'checkbox') {
        const on = v === 'on' || v === 'true';
        if (f.required && !on) return json(400, { error: `Please confirm: ${f.label}` });
        answers.push([f.label, on ? 'Yes' : 'No']);
      } else {
        const s = String(v || '').trim();
        if (f.required && !s) return json(400, { error: `Please fill in: ${f.label}.` });
        if (s.length > (f.type === 'textarea' ? 10000 : 500)) return json(400, { error: `${f.label} is too long.` });
        if (f.type === 'email' && s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return json(400, { error: 'Please enter a valid email address.' });
        answers.push([f.label, s]);
      }
    }
    if (total > MAX_TOTAL) return json(400, { error: 'Your files together are larger than 15 MB.' });

    const now = new Date();
    const name = String(form.get('fullName') || 'Applicant').replace(/[\r\n]+/g, ' ').trim();
    const slug = name.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'Applicant';
    const reference = `${now.toISOString().slice(0, 10)}_${slug}_${crypto.randomUUID().slice(0, 6)}`;
    const folder = `${cfg.cohortYear || now.getFullYear()}/${reference}/`;
    const when = now.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' });
    const text = [
      `SDOH ART Fellowship application (${cfg.cohortYear} cohort)`,
      `Submitted: ${when} ET`,
      `Reference: ${reference}`,
      '',
      ...answers.map(([k, v]) => `${k}:\n${v}\n`),
      `Attached files: ${files.map(f => `${f.field}.${f.ext}`).join(', ') || 'none'}`,
    ].join('\n');

    try {
      await env.APPLICATIONS.put(folder + 'application.txt', text, { httpMetadata: { contentType: 'text/plain; charset=utf-8' } });
      for (const f of files) await env.APPLICATIONS.put(`${folder}${f.field}.${f.ext}`, f.data, { httpMetadata: { contentType: f.type } });
    } catch (e) {
      console.error('R2 save failed', e);
      return json(500, { error: 'We could not save your application.' });
    }

    // The application is safely stored; a failed email must not turn into a failed submission.
    const replyTo = String(form.get('email') || '').trim();
    for (const to of env.NOTIFY_TO.split(',').map(s => s.trim()).filter(Boolean)) {
      try {
        const raw = mime({
          from: env.FROM, to, replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo) ? replyTo : '',
          subject: `New SDOH ART application: ${name}`, text,
          files: files.map(f => ({ filename: `${slug}_${f.field}.${f.ext}`, type: f.type, data: f.data })),
        });
        await env.MAILER.send(new EmailMessage(env.FROM, to, raw));
      } catch (e) {
        console.error('email failed', to, e);
      }
    }
    return json(200, { ok: true, reference });
  },
};

function b64(buf) {
  const a = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
}
const wrap = s => s.replace(/.{1,76}/g, '$&\r\n');
const utf8 = s => new TextEncoder().encode(s);

export function mime({ from, to, replyTo, subject, text, files }) {
  const b = 'b' + crypto.randomUUID();
  return [
    `From: SDOH ART Fellowship <${from}>`,
    `To: ${to}`,
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: =?UTF-8?B?${b64(utf8(subject))}?=`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${from.split('@')[1]}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${b}"`,
    '',
    `--${b}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(b64(utf8(text))),
    ...files.flatMap(f => [
      `--${b}`,
      `Content-Type: ${f.type}; name="${f.filename}"`,
      `Content-Disposition: attachment; filename="${f.filename}"`,
      'Content-Transfer-Encoding: base64',
      '',
      wrap(b64(f.data)),
    ]),
    `--${b}--`,
    '',
  ].join('\r\n');
}
