// Page-local behaviour for the L Hopkins flight build. The engine stays untouched;
// bespoke parts read the engine's --sc-p off each act.
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var actP = function (el) { return parseFloat(el.style.getPropertyValue('--sc-p')) || 0; };

  // ---- route rail: the plane rides page progress; waypoints mark the leg ----
  var route = document.querySelector('.route');
  var legs = [].slice.call(route.querySelectorAll('a')).map(function (a) {
    return { a: a, el: document.querySelector(a.getAttribute('href')) };
  });
  // Measure once (and on resize), then work from cached numbers: scrolling
  // reads only scrollY, never layout, and writes at most once per frame.
  var tops = [], max = 1, routeQueued = false, lastLeg = null;
  function measure() {
    tops = legs.map(function (l) { return l.el.getBoundingClientRect().top + scrollY; });
    max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    updateRoute();
  }
  function updateRoute() {
    routeQueued = false;
    route.style.setProperty('--route-p', Math.min(1, scrollY / max).toFixed(4));
    // Current section: the last one whose top has passed 40% of the viewport;
    // at the very bottom of the page, the last section.
    var line = scrollY + innerHeight * 0.4, i = 0;
    for (var k = 0; k < tops.length; k++) if (tops[k] <= line) i = k;
    if (scrollY >= max - 2) i = legs.length - 1;
    if (legs[i] !== lastLeg) {
      lastLeg = legs[i];
      legs.forEach(function (l) { if (l === lastLeg) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current'); });
    }
  }
  addEventListener('scroll', function () { if (!routeQueued) { routeQueued = true; requestAnimationFrame(updateRoute); } }, { passive: true });
  addEventListener('resize', measure);
  addEventListener('load', measure);
  measure();

  // ---- takeoff: pointer depth, additive only -------------------------------
  // --mx is written on the two layers that use it, not inherited from the stage.
  var takeoff = document.querySelector('.takeoff__stage');
  var depthLayers = [takeoff.querySelector('.takeoff__sky'), takeoff.querySelector('.takeoff__l')];
  var mx = 0, tx = 0;
  if (fine && !reduce) {
    takeoff.addEventListener('pointermove', function (e) { tx = (e.clientX / innerWidth) * 2 - 1; wake(); });
    takeoff.addEventListener('pointerleave', function () { tx = 0; wake(); });
  }

  // ---- departures: the board flips once when it arrives --------------------
  var board = document.querySelector('[data-board]');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { board.classList.add('is-in'); obs.disconnect(); } });
    }, { threshold: 0.2 }).observe(board);
  } else board.classList.add('is-in');

  // ---- long jump: her four official marks, drawn to scale -----------------
  // x: the board sits at 80; 1 m = 175 units, so 6 m lands at 1130.
  var FLIGHTS = [
    { d: 5.22, meet: 'Pioneer Meet, April 2025. Meet record.' },
    { d: 5.17, meet: 'USATF National Junior Olympics, July 2025. Champion.', title: true },
    { d: 5.28, meet: 'New Balance Nationals Indoor, March 2026. Bronze.' },
    { d: 5.47, meet: 'Phoenix Invitational, April 2026. Arizona No. 1.', best: true }
  ];
  var BOARD_X = 80, PER_M = 175, GROUND = 360, SVGNS = 'http://www.w3.org/2000/svg';
  var flightsAct = document.getElementById('longjump');
  var arcsG = document.querySelector('[data-arcs]');
  var ticksG = document.querySelector('[data-ticks]');
  var pit = document.querySelector('[data-pit]');
  var meetEl = document.querySelector('[data-flight-meet]');
  var distEl = document.querySelector('[data-flight-dist]');
  var PIT_MIN = 5.10, PIT_MAX = 5.50;

  for (var m = 0; m <= 6; m++) {
    var x = BOARD_X + m * PER_M;
    var t = document.createElementNS(SVGNS, 'line');
    t.setAttribute('class', 'tick'); t.setAttribute('x1', x); t.setAttribute('x2', x); t.setAttribute('y1', GROUND); t.setAttribute('y2', GROUND + 10);
    var lab = document.createElementNS(SVGNS, 'text');
    lab.setAttribute('class', 'tick-label'); lab.setAttribute('x', x); lab.setAttribute('y', GROUND + 32); lab.setAttribute('text-anchor', 'middle');
    lab.textContent = m + ' m';
    ticksG.appendChild(t); ticksG.appendChild(lab);
  }
  for (var c = 0; c <= 8; c++) { // pit scale every 5 cm
    var s = document.createElement('span'); s.className = 'scale'; s.style.setProperty('--x', c / 8); pit.appendChild(s);
  }
  FLIGHTS.forEach(function (f, i) {
    var end = BOARD_X + f.d * PER_M, apex = 150 + i * 14; // illustrative heights, drawn for scale only
    var path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', 'M' + BOARD_X + ' ' + GROUND + ' Q ' + ((BOARD_X + end) / 2) + ' ' + (GROUND - apex * 2) + ' ' + end + ' ' + GROUND);
    path.setAttribute('class', 'arc' + (f.title ? ' is-title' : '') + (f.best ? ' is-best' : ''));
    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('r', 6); dot.setAttribute('class', 'dot'); dot.style.opacity = 0;
    arcsG.appendChild(path); arcsG.appendChild(dot);
    f.path = path; f.dot = dot; f.len = path.getTotalLength();
    path.style.strokeDasharray = f.len; path.style.strokeDashoffset = f.len;
    var mark = document.createElement('div');
    var mx_ = (f.d - PIT_MIN) / (PIT_MAX - PIT_MIN);
    mark.className = 'mark' + (i % 2 ? ' is-low' : '') + (mx_ > 0.8 ? ' is-end' : '');
    mark.style.setProperty('--x', ((f.d - PIT_MIN) / (PIT_MAX - PIT_MIN)).toFixed(4));
    mark.innerHTML = '<span>' + f.d.toFixed(2) + '<i> m</i>' + (f.title ? '<b> · champion</b>' : f.best ? '<b> · best</b>' : '') + '</span>';
    pit.appendChild(mark); f.mark = mark;
  });

  // Silence for the first 14% of the act, then four windows, then a hold.
  var START = 0.04, WIN = 0.19;
  var lastKey = '';
  function updateFlights() {
    var p = reduce ? 1 : actP(flightsAct);
    var live = -1;
    FLIGHTS.forEach(function (f, i) {
      var k = Math.max(0, Math.min(1, (p - START - i * WIN) / (WIN * 0.86)));
      f.path.style.strokeDashoffset = (f.len * (1 - k)).toFixed(1);
      f.path.style.strokeDasharray = k >= 1 ? ((f.best || f.title) ? 'none' : '6 7') : f.len;
      f.path.classList.toggle('is-done', k >= 1);
      f.path.classList.toggle('is-live', k > 0 && k < 1);
      if (k > 0 && k < 1) {
        var pt = f.path.getPointAtLength(f.len * k);
        f.dot.setAttribute('cx', pt.x); f.dot.setAttribute('cy', pt.y); f.dot.style.opacity = 1;
      } else f.dot.style.opacity = 0;
      f.mark.classList.toggle('is-on', k >= 1);
      if (k > 0) live = i;
      f.k = k;
    });
    var key, meet, dist;
    if (live < 0) { meet = 'From the takeoff board'; dist = '0.00 m'; }
    else {
      var f = FLIGHTS[live];
      meet = f.meet; dist = (f.d * f.k).toFixed(2) + ' m';
    }
    key = meet + dist;
    if (key !== lastKey) { meetEl.textContent = meet; distEl.textContent = dist; lastKey = key; }
  }

  // ---- highlights: one screen, five chapters --------------------------------
  // Plays muted when it scrolls into view (unless motion is reduced), runs the
  // chapters in order, and pauses when it leaves. Every clip keeps its controls.
  var reel = document.querySelector('[data-reel]');
  var video = reel.querySelector('[data-reel-video]');
  var chapters = [].slice.call(reel.querySelectorAll('.reel__list button'));
  var titleEl = reel.querySelector('[data-reel-title]');
  var metaEl = reel.querySelector('[data-reel-meta]');
  var current = 0, inView = false, switching = false;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  if (saveData) video.preload = 'none';
  function choose(i, play) {
    current = i;
    var b = chapters[i];
    chapters.forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
    switching = true;
    video.src = b.dataset.src; video.poster = b.dataset.poster;
    setTimeout(function () { switching = false; }, 0);
    video.setAttribute('aria-label', b.dataset.label);
    titleEl.textContent = b.dataset.title; metaEl.textContent = b.dataset.meta;
    if (play) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }
  chapters.forEach(function (b, i) { b.addEventListener('click', function () { choose(i, true); }); });
  video.addEventListener('ended', function () { if (inView && !saveData) choose((current + 1) % chapters.length, true); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        inView = en.isIntersecting;
        if (inView && !reduce && !saveData && video.paused && !video.dataset.touched) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); }
        if (!inView && !video.paused) video.pause();
      });
    }, { threshold: 0.5 }).observe(video);
  }
  // Once the visitor pauses it themselves, stop auto-playing it.
  video.addEventListener('pause', function () { if (inView && !switching && !video.ended) video.dataset.touched = '1'; });

  // ---- one loop, which sleeps when nothing on screen needs it ---------------
  var flightsNear = false, running = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      flightsNear = entries[0].isIntersecting; if (flightsNear) wake();
    }, { rootMargin: '25% 0px' }).observe(flightsAct);
  } else flightsNear = true;
  function frame() {
    var busy = false;
    if (flightsNear) { updateFlights(); busy = true; }
    if (!reduce && Math.abs(tx - mx) > 0.001) {
      mx += (tx - mx) * 0.08; busy = true;
      depthLayers.forEach(function (el) { el.style.setProperty('--mx', mx.toFixed(3)); });
    }
    running = busy;
    if (busy) requestAnimationFrame(frame);
  }
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  updateFlights();
  wake();

  // ---- contact: the parent's address never ships. Messages go to a relay. --
  var form = document.querySelector('[data-contact]');
  var status = form.querySelector('[data-contact-status]');
  var send = form.querySelector('button[type=submit]');
  // Errors point at the field that caused them, and clear once it is edited.
  function flag(field, message) {
    status.textContent = message;
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', status.id);
    field.focus();
  }
  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid')) { e.target.removeAttribute('aria-invalid'); e.target.removeAttribute('aria-describedby'); }
  });
  if (!form.getAttribute('data-access-key')) document.querySelector('[data-contact-offline]').hidden = false;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var missing = [].slice.call(form.querySelectorAll('[required]')).find(function (f) { return !f.value.trim(); });
    if (missing) { flag(missing, 'Please add ' + missing.placeholder.toLowerCase() + '.'); return; }
    var email = form.querySelector('[type=email]');
    if (!email.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { flag(email, 'That email address looks incomplete. Check it and send again.'); return; }
    var key = form.getAttribute('data-access-key');
    if (!key) { status.textContent = 'The form is not sending yet. Your message is still here; for now, reach the family on Instagram at @l.h0pkins.'; return; }
    var data = new FormData(form);
    data.append('access_key', key);
    data.append('subject', 'L Hopkins site: message from ' + data.get('name'));
    data.append('from_name', 'L Hopkins website');
    send.disabled = true;
    status.textContent = 'Sending…';
    fetch('https://api.web3forms.com/submit', { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (b) { if (!r.ok || !b.success) throw new Error(); }); })
      .then(function () { form.reset(); status.textContent = 'Sent. The family will reply to the email you gave.'; })
      .catch(function () { status.textContent = 'It did not send. Check your connection and try again; your message is still here.'; })
      .then(function () { send.disabled = false; });
  });
})();
