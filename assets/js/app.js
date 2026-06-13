/* =========================================================================
   SDOH ART Fellowship — single-page app
   Vanilla JS: hash router + data-driven rendering from /data/*.json
   ========================================================================= */

const store = {};
let boothTimer = null;

/* ---------- utilities ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const main = () => document.getElementById('main');

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function stripTitle(name) {
  return String(name).replace(/^(Dr\.|Prof\.|Mr\.|Ms\.|Mrs\.)\s+/i, '');
}

function initials(name) {
  const parts = stripTitle(name).replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const a = parts[0][0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

function avatar(person, size, solid) {
  const cls = `avatar ${size}${solid ? ' solid' : ''}`;
  if (person.photo) {
    return `<span class="${cls}"><img src="${escapeHtml(person.photo)}" alt="${escapeHtml(person.name)}" /></span>`;
  }
  return `<span class="${cls}" aria-hidden="true">${initials(person.name)}</span>`;
}

function mdToHtml(md) {
  const lines = String(md || '').split('\n');
  let html = '', inList = false;
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { if (inList) { html += '</ul>'; inList = false; } continue; }
    if (line.startsWith('## ')) {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<h2>${inline(line.slice(3))}</h2>`;
    } else if (line.startsWith('- ')) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(line.slice(2))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      html += `<p>${inline(line)}</p>`;
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function pageHead(eyebrow, title, sub) {
  return `<header class="page-head">
    ${eyebrow ? `<div class="eyebrow">${escapeHtml(eyebrow)}</div>` : ''}
    <h1>${escapeHtml(title)}</h1>
    ${sub ? `<p class="sub">${escapeHtml(sub)}</p>` : ''}
  </header>`;
}

/* ---------- views ---------- */
function renderHome() {
  main().innerHTML = `
    <section class="hero">
      <div class="hero-wrap">
        <div class="hero-inner">
          <p class="hero-eyebrow">Advanced Research Training in Social Determinants of Health</p>
          <h1 class="hero-title">SDOH ART<br />Fellowship</h1>
          <p class="hero-tag">Preparing the next generation of nurse scientists to confront the social drivers of health.</p>
          <div class="hero-cta">
            <a class="btn btn-gold" href="#/about">Explore the fellowship</a>
            <a class="btn btn-hero-ghost" href="#/fellows/2026">Meet the fellows</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true"><img src="assets/img/SDOH_Framework.svg" alt="" /></div>
      </div>
    </section>`;
}

function renderAbout() {
  const a = store.pages.about;
  const check = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 13.6L7 11.8l1.4-1.4 2.4 2.4 4.8-4.8L17 9.4l-6.2 6.2Z" fill="currentColor"/></svg>`;

  const benefits = (a.benefits || []).map(b => `
    <article class="benefit">
      <span class="benefit-ic">${check}</span>
      <div><h4>${escapeHtml(b.title)}</h4><p>${escapeHtml(b.text)}</p></div>
    </article>`).join('');

  const days = ((a.course && a.course.days) || []).map(d => `
    <li class="course-day">
      <span class="cd-day">${escapeHtml(d.day)}</span>
      <span class="cd-body"><strong>${escapeHtml(d.title)}</strong><span>${escapeHtml(d.focus)}</span></span>
    </li>`).join('');

  const elig = (a.eligibility || []).map(e => `<li>${escapeHtml(e)}</li>`).join('');
  const c = a.contact || {};

  main().innerHTML = `${pageHead('About the fellowship', a.headline, '')}
    <div class="editorial">
      <p class="lead">${escapeHtml(a.lead)}</p>
      ${mdToHtml(a.body)}
    </div>
    ${benefits ? `<section class="about-sec"><h2>Benefits of the fellowship</h2><div class="benefit-grid">${benefits}</div></section>` : ''}
    ${days ? `<section class="about-sec"><h2>Course structure</h2>${a.course.intro ? `<p class="sec-sub">${escapeHtml(a.course.intro)}</p>` : ''}<ul class="course-list">${days}</ul></section>` : ''}
    ${elig ? `<section class="about-sec"><h2>Eligibility</h2><ul class="elig-list">${elig}</ul></section>` : ''}
    ${c.email ? `<section class="about-sec"><h2>Contact</h2>
      <div class="contact-card">
        <div><strong>${escapeHtml(c.director || 'Program team')}</strong>${c.note ? `<p>${escapeHtml(c.note)}</p>` : ''}</div>
        <div class="contact-actions">
          <a class="btn btn-primary" href="#/inquiry">Send an inquiry</a>
        </div>
      </div></section>` : ''}`;
}

function puzzlePiece(color) {
  return `<svg class="fw-piece" viewBox="0 0 24 24" aria-hidden="true"><path fill="${escapeHtml(color)}" stroke="#ffffff" stroke-width="0.7" stroke-linejoin="round" d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>`;
}

function renderFramework() {
  const f = store.pages.framework;
  const list = arr => `<ul>${arr.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
  const body = d => d.parts
    ? `<div class="fw-parts">${d.parts.map(p => `<div class="fw-part"><h4 style="color:${escapeHtml(d.color)}">${escapeHtml(p.label)}</h4>${list(p.factors)}</div>`).join('')}</div>`
    : list(d.factors);
  const ordered = [...f.domains].sort((a, b) => (a.parts ? 1 : 0) - (b.parts ? 1 : 0));
  const cards = ordered.map(d => `
    <article class="fw-card${d.parts ? ' wide' : ''}">
      <div class="bar" style="background:${escapeHtml(d.color)}"></div>
      <div class="inner">
        <div class="fw-head">${puzzlePiece(d.color)}<h3>${escapeHtml(d.name)}</h3></div>
        <p class="blurb">${escapeHtml(d.blurb)}</p>
        ${body(d)}
      </div>
    </article>`).join('');
  main().innerHTML = `${pageHead('Framework', f.headline, '')}
    <div class="fw-top">
      <div class="fw-puzzle"><img src="assets/img/SDOH_Framework.svg" alt="The NHWSN four-pillar SDOH framework: Social, Cultural, Environmental and Policy conditions as an interlocking puzzle." /></div>
      <p class="sub">${escapeHtml(f.intro)}</p>
    </div>
    <div class="fw-domains">${cards}</div>
    <div class="editorial" style="margin-top:26px"><p>${escapeHtml(f.closing)}</p></div>`;
}

function renderNews() {
  const items = store.news.news || [];
  const cards = items.map(n => `
    <a class="news-card" href="${escapeHtml(n.url)}" target="_blank" rel="noopener">
      ${n.image ? `<img class="thumb" src="${escapeHtml(n.image)}" alt="" />` : '<span class="thumb"></span>'}
      <div class="body">
        <div class="outlet">${escapeHtml(n.outlet)} · ${escapeHtml(n.date)}</div>
        <h3>${escapeHtml(n.title)}</h3>
        <p class="ex">${escapeHtml(n.excerpt)}</p>
        <span class="go">Read the story
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
      </div>
    </a>`).join('');
  main().innerHTML = `${pageHead('News', 'In the news', 'Coverage and announcements about the SDOH ART Fellowship.')}
    <div class="grid">${cards || '<p>No news items yet.</p>'}</div>`;
}

function linkedinIcon(url) {
  const svg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21H17v-4.9c0-1.17-.02-2.68-1.9-2.68-1.9 0-2.2 1.28-2.2 2.6V21H9z"/></svg>`;
  if (url) return `<a class="fac-li" href="${escapeHtml(url)}" target="_blank" rel="noopener" aria-label="LinkedIn profile">${svg}</a>`;
  return `<span class="fac-li disabled" title="LinkedIn — add via CMS" aria-hidden="true">${svg}</span>`;
}

function facTags(f) {
  const arr = (f.areaOfResearch || '').split(';').map(s => s.trim()).filter(Boolean);
  if (!arr.length) return '<div class="fac-tags"><span class="ph">Research area to be added</span></div>';
  return `<div class="fac-tags">${arr.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`;
}

function renderFaculty() {
  const fac = store.faculty.faculty || [];
  const core = fac.filter(f => f.role === 'core');
  const mentors = fac.filter(f => f.role !== 'core');

  const coreCard = f => `
    <article class="fac-card core-card" data-fid="${escapeHtml(f.id)}">
      ${avatar(f, 'core')}
      <div class="core-info">
        <div class="core-eyebrow">Program leadership</div>
        <div class="core-name">${escapeHtml(f.name)}</div>
        <div class="fac-desg">${escapeHtml(f.title || 'Faculty Mentor')}</div>
        <div class="fac-inst">${escapeHtml(f.institute || 'Emory University')}</div>
        ${facTags(f)}
      </div>
    </article>`;

  const mentorCard = f => `
    <article class="fac-card" data-fid="${escapeHtml(f.id)}">
      ${avatar(f, 'fac')}
      <div class="fac-name">${escapeHtml(f.name)}</div>
      <div class="fac-desg">${escapeHtml(f.title || 'Faculty Mentor')}</div>
      <div class="fac-inst">${escapeHtml(f.institute || 'Emory University')}</div>
      ${facTags(f)}
    </article>`;

  main().innerHTML = `${pageHead('Faculty involved', 'Faculty & mentors', 'A network of NIH-funded Emory faculty mentors guides each fellow, matched to their research focus.')}
    ${core.map(coreCard).join('')}
    <div class="fac-grid">${mentors.map(mentorCard).join('')}</div>`;
}

function cohortLabel(c) { return `${c} cohort`; }

function renderFellows(cohortStr, selId) {
  const cohort = Number(cohortStr);
  const list = (store.fellows.fellows || []).filter(f => f.cohort === cohort);

  if (!list.length) {
    main().innerHTML = `${pageHead('Fellows', `${cohort} cohort`, '')}
      <div class="detail" style="max-width:640px">
        <h2>Applications open soon</h2>
        <p>The ${cohort} cohort has not yet been selected. The SDOH ART Fellowship is funded through 2027 — check the <a href="#/apply">Apply</a> page for upcoming deadlines, or send an <a href="#/inquiry">inquiry</a> to join the interest list.</p>
      </div>`;
    return;
  }

  const fyCount = list.filter(f => f.firstYear).length;
  const selected = list.find(f => f.id === selId) || list[0];

  const listItems = list.map(f => `
    <a class="dir-item ${f.id === selected.id ? 'active' : ''}" href="#/fellows/${cohort}/${f.id}">
      ${avatar(f, 'sm', f.id === selected.id)}
      <span class="who">
        <span class="nm">${escapeHtml(f.name)}</span>
        <span class="inst">${escapeHtml(shortInst(f.institution))}</span>
      </span>
    </a>`).join('');

  main().innerHTML = `${pageHead('Fellows', `${cohort} cohort`, '')}
    <div class="count-pills">
      <span class="pill">${list.length} fellows</span>
      ${fyCount ? `<span class="pill gold">${fyCount} first-year PhD</span>` : ''}
    </div>
    <div class="directory" style="margin-top:18px">
      <div class="dir-list" id="dirList">${listItems}</div>
      ${fellowDetail(selected)}
    </div>`;
}

function shortInst(inst) {
  return String(inst).split(',')[0]
    .replace('University of ', 'U. ');
}

function drNames(str) {
  return String(str || '').split(/\s*[,&]\s*/).map(s => {
    s = s.trim();
    if (!s) return '';
    return /^(dr|drs|prof|professor)\b/i.test(s) ? s : 'Dr. ' + s;
  }).filter(Boolean).join(', ');
}

function fellowDetail(f) {
  const rows = [];
  rows.push(['Institution', f.institution]);
  rows.push(['Role', f.role]);
  rows.push(['Research focus', f.focus]);
  if (f.mentorEmory) rows.push(['Emory mentor', drNames(f.mentorEmory)]);
  if (f.mentorExternal) rows.push(['External mentor', drNames(f.mentorExternal)]);
  rows.push(['Status', f.status || 'Fellow']);
  const rowHtml = rows.map(([k, v]) => `
    <div class="detail-row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('');
  return `<section class="detail" aria-live="polite">
    <div class="detail-head">
      ${avatar(f, 'lg')}
      <div class="who">
        <h2>${escapeHtml(f.name)}${f.credentials ? `, ${escapeHtml(f.credentials)}` : ''}</h2>
        <div class="role">${escapeHtml(f.role)}</div>
        <div class="inst">${escapeHtml(f.institution)}</div>
        ${f.firstYear ? '<span class="badge fy">First-year PhD fellow</span>' : `<span class="badge">${escapeHtml(f.status || 'Fellow')}</span>`}
      </div>
    </div>
    <div class="detail-grid">${rowHtml}</div>
    ${f.bio ? `<div class="detail-bio"><h3>About</h3><p>${escapeHtml(f.bio)}</p></div>` : ''}
  </section>`;
}

function renderGallery() {
  const items = store.gallery.gallery || [];
  const slides = items.map((g, i) => `
    <figure class="booth-slide ${i === 0 ? 'active' : ''}" data-i="${i}">
      <img src="${escapeHtml(g.image)}" alt="${escapeHtml(g.caption)}" style="object-fit:${g.fit === 'contain' ? 'contain' : 'cover'}" />
      <figcaption class="booth-cap">${escapeHtml(g.caption)}</figcaption>
    </figure>`).join('');
  const dots = items.map((g, i) => `<button class="booth-dot ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Show photo ${i + 1}"></button>`).join('');
  main().innerHTML = `${pageHead('Photo Booth', 'Moments from the fellowship', 'An auto-playing stream of photos from past cohorts, courses, and receptions.')}
    <div class="booth">
      <div class="booth-stage" id="boothStage">${slides}</div>
      <div class="booth-controls">
        <button class="booth-btn" id="boothPrev" aria-label="Previous photo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="M15 18 9 12l6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span style="display:flex;gap:10px">${dots}</span>
        <button class="booth-btn" id="boothNext" aria-label="Next photo"><svg viewBox="0 0 24 24" width="18" height="18" fill="none"><path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>`;
  startBooth(items.length);
}

function startBooth(n) {
  if (n < 1) return;
  let cur = 0;
  const stage = $('#boothStage');
  const go = i => {
    cur = (i + n) % n;
    stage.querySelectorAll('.booth-slide').forEach(s => s.classList.toggle('active', Number(s.dataset.i) === cur));
    document.querySelectorAll('.booth-dot').forEach(d => d.classList.toggle('active', Number(d.dataset.i) === cur));
  };
  $('#boothNext').onclick = () => { go(cur + 1); resetTimer(); };
  $('#boothPrev').onclick = () => { go(cur - 1); resetTimer(); };
  document.querySelectorAll('.booth-dot').forEach(d => d.onclick = () => { go(Number(d.dataset.i)); resetTimer(); });
  const resetTimer = () => { clearInterval(boothTimer); boothTimer = setInterval(() => go(cur + 1), 4500); };
  resetTimer();
}

/* ---------- apply ---------- */
function renderApply() {
  const cfg = store.apply;
  const open = cfg.applicationsOpen === true;
  const fields = (cfg.fields || []).filter(f => f.enabled !== false);

  const banner = open
    ? `<div class="apply-status open"><strong>Applications are open.</strong>${cfg.deadline ? ` Deadline: ${escapeHtml(cfg.deadline)}.` : ''}</div>`
    : `<div class="apply-status closed"><strong>Applications are not open yet.</strong> The application portal will open when the next cohort is announced. Please review the program circular below in the meantime.</div>`;

  const circular = cfg.circular ? `
    <section class="form-card circular-card">
      <h3>Program circular</h3>
      <p class="muted-note">The official program announcement and details for the SDOH ART Fellowship. If the preview below does not load, use these buttons.</p>
      <div class="form-actions" style="margin-bottom:14px">
        <a class="btn btn-primary" href="${escapeHtml(cfg.circular)}" target="_blank" rel="noopener">Open the circular (PDF)</a>
        <a class="btn btn-ghost" href="${escapeHtml(cfg.circular)}" download>Download PDF</a>
      </div>
      <div class="pdf-frame"><iframe src="${escapeHtml(cfg.circular)}#view=FitH" title="SDOH ART Fellowship program circular" loading="lazy"></iframe></div>
    </section>` : '';

  let appBlock = '';
  if (!open) {
    appBlock = `<section class="form-card">
      <h3>Application</h3>
      <p>The application portal is currently closed. It will open for submissions once the next cohort is announced. Add yourself to the interest list on the <a href="#/inquiry">Inquiry</a> page to be notified when it opens.</p>
      <button class="btn btn-gold" disabled aria-disabled="true">Start application — opens soon</button>
    </section>`;
  } else if (cfg.applicationUrl) {
    appBlock = `<section class="form-card">
      <h3>Application</h3>
      <div class="form-note"><p style="margin:0"><strong>Eligibility.</strong> ${escapeHtml(cfg.eligibility)}</p></div>
      <p>${escapeHtml(cfg.intro)}</p>
      <a class="btn btn-gold" href="${escapeHtml(cfg.applicationUrl)}" target="_blank" rel="noopener">Start application</a>
    </section>`;
  } else {
    appBlock = `<div class="form-note">
        <p style="margin:0 0 6px"><strong>Eligibility.</strong> ${escapeHtml(cfg.eligibility)}</p>
        <p style="margin:0"><strong>Deadline.</strong> ${escapeHtml(cfg.deadline)}</p>
      </div>
      <p>${escapeHtml(cfg.intro)}</p>
      <div id="applyMsg"></div>
      <form class="form-card" id="applyForm" name="application" enctype="multipart/form-data" novalidate>
        ${fields.map(fieldMarkup).join('')}
        <div class="form-actions">
          <button type="submit" class="btn btn-primary">Submit application</button>
          <button type="button" class="btn btn-ghost" id="downloadCopy">Download PDF copy</button>
        </div>
      </form>`;
  }

  main().innerHTML = `${pageHead('Apply', cfg.headline, '')}
    <div class="form-wrap">
      ${banner}
      ${circular}
      ${appBlock}
    </div>`;

  if (open && !cfg.applicationUrl) {
    $('#applyForm').addEventListener('submit', submitApplication);
    $('#downloadCopy').addEventListener('click', () => downloadCopy(fields));
  }
}

function fieldMarkup(f) {
  const req = f.required ? '<span class="req" aria-hidden="true">*</span>' : '';
  const help = f.help ? `<div class="help">${escapeHtml(f.help)}</div>` : '';
  const reqAttr = f.required ? 'required' : '';
  if (f.type === 'checkbox') {
    return `<div class="field check">
      <input type="checkbox" id="${f.name}" name="${f.name}" ${reqAttr} />
      <label for="${f.name}">${escapeHtml(f.label)}${req}</label></div>`;
  }
  let input = '';
  if (f.type === 'textarea') {
    input = `<textarea id="${f.name}" name="${f.name}" ${reqAttr}></textarea>`;
  } else if (f.type === 'select') {
    const opts = ['<option value="">Select…</option>'].concat((f.options || []).map(o => `<option>${escapeHtml(o)}</option>`)).join('');
    input = `<select id="${f.name}" name="${f.name}" ${reqAttr}>${opts}</select>`;
  } else if (f.type === 'file') {
    const accept = f.name === 'cv' ? 'accept=".pdf,.doc,.docx"' : (f.name === 'photo' ? 'accept="image/*"' : '');
    input = `<input type="file" id="${f.name}" name="${f.name}" ${accept} ${reqAttr} />`;
  } else {
    input = `<input type="${f.type || 'text'}" id="${f.name}" name="${f.name}" ${reqAttr} />`;
  }
  return `<div class="field">
    <label for="${f.name}">${escapeHtml(f.label)}${req}</label>
    ${input}${help}</div>`;
}

function submitApplication(e) {
  e.preventDefault();
  const form = e.target;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const data = new FormData(form);
  data.append('form-name', 'application');
  fetch('/', { method: 'POST', body: data }).catch(() => {});
  $('#applyMsg').innerHTML = `<div class="form-success">Thank you — your application has been submitted. A program coordinator will be in touch. You can download a PDF copy below for your records.</div>`;
  $('#applyMsg').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function downloadCopy(fields) {
  const form = $('#applyForm');
  const rows = fields.filter(f => f.type !== 'file').map(f => {
    const el = form.elements[f.name];
    let val = '';
    if (el) val = el.type === 'checkbox' ? (el.checked ? 'Yes' : 'No') : el.value;
    return `<tr><td class="k">${escapeHtml(f.label)}</td><td>${escapeHtml(val || '—')}</td></tr>`;
  }).join('');
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>SDOH ART Fellowship — Application</title>
    <style>
      body{font-family:Georgia,serif;color:#1d2330;max-width:720px;margin:40px auto;padding:0 24px}
      h1{color:#012169;font-size:22px;border-bottom:3px solid #f2a900;padding-bottom:10px}
      .eyebrow{font-family:Arial;letter-spacing:.1em;text-transform:uppercase;font-size:11px;color:#0071b8}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial;font-size:13px}
      td{padding:9px 8px;border-bottom:1px solid #e6e8ec;vertical-align:top}
      td.k{color:#6b7280;width:230px;font-weight:bold}
      .foot{margin-top:24px;font-family:Arial;font-size:11px;color:#6b7280}
    </style></head><body>
    <div class="eyebrow">Emory Nursing · SDOH ART Fellowship</div>
    <h1>Application summary</h1>
    <table>${rows}</table>
    <p class="foot">Uploaded files (CV, headshot) are submitted with your application but not shown in this summary.</p>
    </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 350);
}

/* ---------- inquiry ---------- */
function renderInquiry() {
  const q = store.pages.inquiry;
  main().innerHTML = `${pageHead('Inquiry', q.headline, '')}
    <div class="form-wrap">
      <p>${escapeHtml(q.intro)}</p>
      <div class="form-card">
        <div class="field"><label for="iqName">Your name</label><input type="text" id="iqName" /></div>
        <div class="field"><label for="iqEmail">Your email</label><input type="email" id="iqEmail" /></div>
        <div class="field"><label for="iqMsg">Message</label><textarea id="iqMsg"></textarea></div>
        <div class="form-actions">
          <button type="button" class="btn btn-primary" id="iqSend">Send message</button>
          <a class="btn btn-ghost" href="mailto:${escapeHtml(q.email)}">Email ${escapeHtml(q.email)}</a>
        </div>
      </div>
    </div>`;
  $('#iqSend').addEventListener('click', () => {
    const subj = encodeURIComponent('SDOH ART Fellowship inquiry');
    const body = encodeURIComponent(`Name: ${$('#iqName').value}\nEmail: ${$('#iqEmail').value}\n\n${$('#iqMsg').value}`);
    window.location.href = `mailto:${q.email}?subject=${subj}&body=${body}`;
  });
}

/* ---------- router ---------- */
function route() {
  if (boothTimer) { clearInterval(boothTimer); boothTimer = null; }
  const hash = location.hash || '#/about';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const head = parts[0] || 'home';
  try {
    switch (head) {
      case 'home': renderHome(); break;
      case 'about': renderAbout(); break;
      case 'framework': renderFramework(); break;
      case 'news': renderNews(); break;
      case 'apply': renderApply(); break;
      case 'inquiry': renderInquiry(); break;
      case 'faculty': renderFaculty(); break;
      case 'gallery': renderGallery(); break;
      case 'fellows': renderFellows(parts[1] || '2026', parts[2]); break;
      default: renderHome();
    }
  } catch (err) {
    main().innerHTML = `<div class="loading">Something went wrong rendering this page.</div>`;
    console.error(err);
  }
  main().classList.toggle('is-home', head === 'home');
  syncNav('#/' + parts.join('/'));
  closeMenu();
  main().focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function syncNav(hash) {
  const base = '#/' + hash.replace(/^#\/?/, '').split('/').slice(0, 2).join('/');
  document.querySelectorAll('[data-route]').forEach(el => {
    const r = el.getAttribute('data-route');
    const on = hash.startsWith(r) || base === r || ('#/' + hash.replace(/^#\/?/, '').split('/')[0]) === r;
    el.classList.toggle('active', hash === r || hash.startsWith(r + '/') || hash.split('/').slice(0,2).join('/') === r);
  });
}

/* ---------- chrome: menu + search + nav buttons ---------- */
function openMenu() { document.body.classList.add('nav-open'); $('#menuToggle').setAttribute('aria-expanded', 'true'); }
function closeMenu() { document.body.classList.remove('nav-open'); const t = $('#menuToggle'); if (t) t.setAttribute('aria-expanded', 'false'); }

function wireChrome() {
  document.addEventListener('click', e => {
    const r = e.target.closest('[data-route]');
    if (r) { e.preventDefault(); location.hash = r.getAttribute('data-route'); }
  });
  $('#menuToggle').addEventListener('click', () => document.body.classList.contains('nav-open') ? closeMenu() : openMenu());
  $('#scrim').addEventListener('click', closeMenu);
  $('#search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const listEl = $('#dirList');
    if (!listEl) return;
    listEl.querySelectorAll('.dir-item').forEach(it => {
      const txt = it.textContent.toLowerCase();
      it.style.display = txt.includes(q) ? '' : 'none';
    });
  });
}

/* ---------- boot ---------- */
async function boot() {
  wireChrome();
  try {
    const [fellows, faculty, news, gallery, pages, apply] = await Promise.all(
      ['fellows', 'faculty', 'news', 'gallery', 'pages', 'apply'].map(n =>
        fetch(`data/${n}.json`).then(r => r.json()))
    );
    store.fellows = fellows; store.faculty = faculty; store.news = news;
    store.gallery = gallery; store.pages = pages; store.apply = apply;
  } catch (err) {
    main().innerHTML = `<div class="loading">Could not load program data. Please refresh.</div>`;
    console.error(err);
    return;
  }
  window.addEventListener('hashchange', route);
  if (!location.hash) location.hash = '#/home';
  route();
}

boot();
