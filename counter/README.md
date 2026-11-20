# Visitor counter

The website is static on GitHub Pages, which cannot run server code, so the
visit counts live in a small Cloudflare Worker instead.

Counting and showing are separate. Every page load is **counted**, silently.
The numbers are **shown** on every page load, including a refresh, as a
small toast that slides into the bottom-right about a second after the page
settles, holds for 10 seconds, then slides up and is removed from the page.
Hovering it pauses the timer.

```
browser  ──►  count.sdohartfellowship.org   (Worker: worker.js)
                        │
                        └──►  KV namespace SDOH_KV, key "stats:v1"
```

Three numbers are kept:

| Shown      | Means                                               |
|------------|-----------------------------------------------------|
| `Today`    | visitors so far today (once per browser per UTC day) |
| `All time` | the same count, never reset                          |
| `Views`    | raw page loads, so a repeat visit counts again       |

Known crawlers are excluded, and only our own pages may increment. Reads are
public.

## One-time setup

Everything below runs from this folder. The domain is already on this
Cloudflare account, so there is nothing to buy.

```bash
cd counter
npx wrangler login
npx wrangler kv namespace create SDOH_KV
```

The last command prints an id. Paste it into `wrangler.toml` in place of
`PASTE_KV_NAMESPACE_ID_HERE`, then:

```bash
npx wrangler deploy
```

That publishes the Worker and attaches `count.sdohartfellowship.org` to it.
Give DNS a minute, then check it:

```bash
curl "https://count.sdohartfellowship.org/?action=read"
```

A fresh counter answers `{"total":0,"today":0,"views":0,...}`. Once that works,
push the site and the toast appears on its own.

## Timings

All three knobs are at the top of `../assets/js/counter.js`:

| Constant      | Default | What it does                          |
|---------------|---------|---------------------------------------|
| `ENTER_DELAY` | 1100 ms | wait after load before sliding in     |
| `HOLD_MS`     | 10000 ms | how long it stays put                |
| `EXIT_MS`     | 520 ms  | slide-up duration, matches the CSS    |

Change `EXIT_MS` and the `.vcount.is-out` transition duration in
`../assets/css/styles.css` together, or the element is removed mid-animation.

## Serving it somewhere else

If you would rather not use a subdomain, delete the `routes` block from
`wrangler.toml` and deploy. Cloudflare will give the Worker a
`https://sdoh-counter.<your-subdomain>.workers.dev` address. Put that address
in `API` at the top of `../assets/js/counter.js`.

## Keeping the numbers private

The counter can keep counting without showing anything. In
`../assets/js/counter.js` set:

```js
var SHOW_PUBLICLY = false;
```

The toast then appears only when the site is opened as
`https://sdohartfellowship.org/?stats=1#/home`, which is a link only you need
to know.

## Reading or resetting the numbers by hand

```bash
npx wrangler kv key get --binding SDOH_KV "stats:v1" --remote
npx wrangler kv key put --binding SDOH_KV "stats:v1" \
  '{"total":0,"views":0,"date":"1970-01-01","today":0,"w":0}' --remote
```

## Limits

Cloudflare's free tier allows 100,000 Worker requests and 1,000 KV writes per
day. This site is nowhere near either. The Worker still caps itself at 600
writes a day and switches to sampled counting past 300, because the Pulse for
Nurses counter exhausted this exact quota on 2026-09-30 when crawler traffic
spiked, and the failure spread to an unrelated endpoint. If the cap is ever
hit here, counting pauses until midnight UTC and nothing else is affected.

## If the Worker is down

Nothing appears at all. No error, no empty box, no broken layout. That is
deliberate: a half-working counter on a fellowship site looks worse than no
counter at all.

## Tests

The Worker is plain JavaScript using standard `Request`/`Response`, so it runs
under Node without Cloudflare. Copy `worker.js` to `worker.mjs` beside a fake
KV and call `worker.fetch(request, env)` directly. The suite used during
development covers: empty store, first visit of day, repeat load, crawler
rejection, foreign-origin rejection, Referer fallback, the github.io mirror,
day rollover, budget exhaustion, KV failure, and a missing binding.
