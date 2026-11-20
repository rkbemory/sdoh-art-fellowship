/* SDOH ART Fellowship — visitor counter API (Cloudflare Worker + KV).

   The website itself is static on GitHub Pages, which cannot run server code,
   so the counts live here instead. The page calls this Worker; this Worker is
   the only thing that touches storage.

     GET /?action=read          -> { total, today, views }
     GET /?action=view          -> +1 to total page views
     GET /?action=view&daily=1  -> also +1 to today + all-time (once per browser/day)

   Storage is ONE JSON blob in KV (binding SDOH_KV, key "stats:v1"):
     { total, views, date, today, w }
       total — unique-ish visitors all time (once per browser per UTC day)
       views — raw page loads
       date  — UTC day the `today` and `w` counters belong to
       today — visitors so far on `date`
       w     — KV writes already spent on `date`

   WHY THE WRITE ACCOUNTING EXISTS
   -------------------------------
   Cloudflare's free tier allows 1,000 KV writes per day. The Pulse for Nurses
   counter learned this the hard way on 2026-09-30: crawlers have no
   localStorage, so every bot hit looked like a first-visit-of-day, burned
   writes, and inflated the numbers. The quota ran out and took an unrelated
   endpoint down with it. Three defences carry over from that:

     1. BOT FILTER  — known crawlers are never counted and never written.
     2. SINGLE KEY  — one blob, so a counted visit costs 1 write, not 3.
     3. ORIGIN LOCK — only our own pages may increment; reads stay public.

   Write failures are swallowed on purpose. A counter must never be able to
   return an error to the page. */

const KEY = 'stats:v1';

const ALLOW_ORIGINS = [
  'https://sdohartfellowship.org',
  'https://www.sdohartfellowship.org',
  'https://rkbemory.github.io', // the GitHub Pages mirror
];

/* Stop writing well short of the 1,000/day free-tier ceiling. */
const WRITE_BUDGET = 600;

/* This site is low traffic, so plain page views are counted EXACTLY while the
   day is quiet. Only if a day gets busy enough to threaten the budget do views
   switch to 1-in-N sampling (write once every N requests, add N). The expected
   total is the same either way; the number just climbs in steps instead of
   one at a time. Daily visitors are always counted exactly. */
const SAMPLE_AFTER = 300;
const SAMPLE_N = 5;

/* Well-behaved crawlers identify themselves. This will never catch all of
   them, but it removes the bulk of the inflation. */
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|discord|slack|preview|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot|petal|yandex|baidu|duckduck|archive|curl|wget|python-requests|okhttp|headless|lighthouse|gtmetrix|phantom|puppeteer|playwright/i;

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function int(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0',
    // Reads are public. Writes are gated by isOwnSite() below, not by CORS.
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/* Counting only makes sense for our own pages. A crawler hitting this Worker
   directly, or another site embedding it, sends no matching Origin/Referer. */
function isOwnSite(request) {
  const o = request.headers.get('Origin');
  if (o) return ALLOW_ORIGINS.indexOf(o) !== -1;
  const r = request.headers.get('Referer') || '';
  return ALLOW_ORIGINS.some((a) => r === a || r.indexOf(a + '/') === 0);
}

function isBot(request) {
  const ua = request.headers.get('User-Agent') || '';
  if (!ua) return true; // no UA at all is not a real browser
  return BOT_RE.test(ua);
}

/* Returns null when storage itself is unreachable, which is a different thing
   from a store that is simply empty. The caller reports the first as degraded
   so the page can hide the chip rather than show a confident zero. */
async function readStats(kv) {
  let s;
  try {
    s = await kv.get(KEY, { type: 'json' });
  } catch (e) {
    return null;
  }
  if (s && typeof s === 'object') {
    return {
      total: int(s.total),
      views: int(s.views),
      date: s.date || todayUtc(),
      today: int(s.today),
      w: int(s.w),
    };
  }
  return { total: 0, views: 0, date: todayUtc(), today: 0, w: 0 };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(ALLOW_ORIGINS.indexOf(origin) !== -1 ? origin : '*');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    const action = (url.searchParams.get('action') || 'read').toLowerCase();
    const daily1 = url.searchParams.get('daily') === '1';
    const day = todayUtc();

    const kv = env && env.SDOH_KV;
    if (!kv) {
      // Misconfigured binding must still not break the page.
      return new Response(
        JSON.stringify({ total: 0, today: 0, views: 0, degraded: true }),
        { status: 200, headers }
      );
    }

    try {
      const s = await readStats(kv);
      if (!s) {
        return new Response(
          JSON.stringify({ total: 0, today: 0, views: 0, degraded: true }),
          { status: 200, headers }
        );
      }

      const sameDay = s.date === day;

      let total = s.total;
      let views = s.views;
      let today = sameDay ? s.today : 0;
      let writes = sameDay ? s.w : 0;

      const wantsWrite = action === 'view';
      const eligible =
        wantsWrite && isOwnSite(request) && !isBot(request) && writes < WRITE_BUDGET;

      const bumpDaily = eligible && daily1;
      const sample = writes < SAMPLE_AFTER ? 1 : SAMPLE_N;
      const doWrite =
        bumpDaily || (eligible && (sample === 1 || Math.random() < 1 / sample));

      if (doWrite) {
        const next = {
          total: bumpDaily ? total + 1 : total,
          views: views + (bumpDaily ? 1 : sample),
          date: day,
          today: bumpDaily ? today + 1 : today,
          w: writes + 1,
        };
        try {
          await kv.put(KEY, JSON.stringify(next));
          // Adopt the new numbers only once they are actually stored, so a
          // failed write can never report a count that does not exist.
          total = next.total;
          views = next.views;
          today = next.today;
          writes = next.w;
        } catch (e) {
          /* quota exhausted or KV down — serve the stored numbers unchanged */
        }
      }

      return new Response(
        JSON.stringify({ total, today, views, serverDate: day }),
        { status: 200, headers }
      );
    } catch (err) {
      // Never fail the page over a counter.
      return new Response(
        JSON.stringify({ total: 0, today: 0, views: 0, degraded: true }),
        { status: 200, headers }
      );
    }
  },
};
