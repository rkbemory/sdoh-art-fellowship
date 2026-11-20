/* SDOH ART Fellowship — visitor counter.

   Counting and showing are two separate things here:

     COUNT  on every page load, always, silently.
     SHOW   a small toast in the bottom-right on every page load.
            It slides in, holds for 10 seconds, then slides up and is
            removed from the page entirely.

   Counts are kept by a small Cloudflare Worker (see counter/README.md);
   this file only reads them and draws the toast.

   Deliberately self-contained: it does not touch app.js, and if the Worker
   is unreachable nothing appears at all. A half-broken counter on a
   fellowship site looks worse than no counter at all. */
(function () {
  'use strict';

  /* ----- config ------------------------------------------------------- */

  // The Worker that stores the counts. Change this if you deploy it
  // somewhere else (e.g. a *.workers.dev URL).
  var API = 'https://count.sdohartfellowship.org';

  // false = keep counting, but only show the toast to someone who asks for it
  // by loading the site as  ...sdohartfellowship.org/?stats=1#/home
  var SHOW_PUBLICLY = true;

  var DAY_KEY = 'sdoh:lastVisitDay';   // localStorage: one visit per UTC day

  var ENTER_DELAY = 1100;              // let the page settle first
  var HOLD_MS = 10000;                 // visible for 10 s, then it leaves
  var EXIT_MS = 520;                   // must match the CSS transition

  /* ----- helpers ------------------------------------------------------- */

  function utcDay() {
    return new Date().toISOString().slice(0, 10);
  }

  function fmt(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  function get(action) {
    return fetch(API + '/?action=' + action, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        return d && typeof d.total === 'number' && !d.degraded ? d : null;
      })
      .catch(function () { return null; });
  }

  function wanted() {
    if (!SHOW_PUBLICLY) return /[?&]stats=1\b/.test(location.search);
    return true;
  }

  /* ----- toast --------------------------------------------------------- */

  var EYE =
    '<svg class="vc-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
    '<path d="M1.8 12S5.6 5.5 12 5.5 22.2 12 22.2 12 18.4 18.5 12 18.5 1.8 12 1.8 12Z" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.6"/></svg>';

  function stat(label, value) {
    return (
      '<span class="vc-item">' +
      '<span class="vc-k">' + label + '</span>' +
      '<span class="vc-v">' + value + '</span>' +
      '</span>'
    );
  }

  function show(data) {
    var el = document.createElement('div');
    el.className = 'vcount';
    el.title = 'Visitors today · all-time visitors · total page views';
    el.innerHTML =
      '<span class="vc-dot" aria-hidden="true"></span>' +
      EYE +
      stat('Today', fmt(data.today)) +
      '<span class="vc-sep" aria-hidden="true"></span>' +
      stat('All time', fmt(data.total)) +
      '<span class="vc-sep" aria-hidden="true"></span>' +
      stat('Views', fmt(data.views));
    document.body.appendChild(el);

    var timer = null;
    var gone = false;

    function leave() {
      if (gone) return;
      gone = true;
      el.classList.add('is-out');
      // Remove rather than hide, so nothing lingers over the page.
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, EXIT_MS);
    }

    function arm(ms) {
      clearTimeout(timer);
      timer = setTimeout(leave, ms);
    }

    // Two frames: the first paints it off-screen, the second animates it in.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.classList.add('is-in');
        arm(HOLD_MS);
      });
    });

    // Reading it should not be a race against the timer.
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { arm(1400); });
  }

  /* ----- run ----------------------------------------------------------- */

  function start() {
    // Never count or show inside the CMS.
    if (location.pathname.indexOf('/admin') === 0) return;

    var day = utcDay();
    var last = null;
    try {
      last = localStorage.getItem(DAY_KEY);
    } catch (e) {
      /* private mode — treat every load as a repeat visit rather than a new one */
    }
    var firstToday = last !== day;

    // Counting happens on every load, whether or not anything is displayed.
    var first = get(firstToday ? 'view&daily=1' : 'view');

    if (firstToday) {
      first.then(function (d) {
        if (!d) return;
        try { localStorage.setItem(DAY_KEY, day); } catch (e) {}
      });
    }

    if (!wanted()) return;

    first.then(function (d) {
      if (!d) return; // Worker unreachable: leave the page as it was
      setTimeout(function () { show(d); }, ENTER_DELAY);
    });
  }

  if (document.readyState !== 'loading') start();
  else document.addEventListener('DOMContentLoaded', start);
})();
