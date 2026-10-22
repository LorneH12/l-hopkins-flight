// Page-local behaviour for the Flight log build. The engine stays untouched;
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
  function updateRoute() {
    var max = document.documentElement.scrollHeight - innerHeight;
    route.style.setProperty('--route-p', (max > 0 ? scrollY / max : 0).toFixed(4));
    var current = legs[0];
    legs.forEach(function (l) { if (l.el.getBoundingClientRect().top <= innerHeight * 0.4) current = l; });
    legs.forEach(function (l) {
      if (l === current) l.a.setAttribute('aria-current', 'true'); else l.a.removeAttribute('aria-current');
    });
  }

  // ---- takeoff: pointer depth, additive only -------------------------------
  var takeoff = document.querySelector('.takeoff__stage');
  var mx = 0, tx = 0;
  if (fine && !reduce) {
    takeoff.addEventListener('pointermove', function (e) { tx = (e.clientX / innerWidth) * 2 - 1; });
    takeoff.addEventListener('pointerleave', function () { tx = 0; });
  }

  // ---- departures: the board flips once when it arrives --------------------
  var board = document.querySelector('[data-board]');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (en) { if (en.isIntersecting) { board.classList.add('is-in'); obs.disconnect(); } });
    }, { threshold: 0.2 }).observe(board);
  } else board.classList.add('is-in');

  // ---- four flights: her official long jumps, flown to scale ----------------
  // x: the board sits at 80; 1 m = 175 units, so 6 m lands at 1130.
  var FLIGHTS = [
    { d: 5.22, meet: 'Pioneer Meet, April 2025. Meet record.' },
    { d: 5.17, meet: 'USATF National Junior Olympics, July 2025. Champion.', title: true },
    { d: 5.28, meet: 'New Balance Nationals Indoor, March 2026. Bronze.' },
    { d: 5.47, meet: 'Phoenix Invitational, April 2026. Arizona No. 1.' }
  ];
  var BOARD_X = 80, PER_M = 175, GROUND = 360, SVGNS = 'http://www.w3.org/2000/svg';
  var flightsAct = document.getElementById('flights');
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
    path.setAttribute('class', 'arc' + (f.title ? ' is-title' : ''));
    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('r', 6); dot.setAttribute('class', 'dot'); dot.style.opacity = 0;
    arcsG.appendChild(path); arcsG.appendChild(dot);
    f.path = path; f.dot = dot; f.len = path.getTotalLength();
    path.style.strokeDasharray = f.len; path.style.strokeDashoffset = f.len;
    var mark = document.createElement('div');
    mark.className = 'mark' + (i % 2 ? ' is-low' : '');
    mark.style.setProperty('--x', ((f.d - PIT_MIN) / (PIT_MAX - PIT_MIN)).toFixed(4));
    mark.innerHTML = '<span>' + f.d.toFixed(2) + ' m' + (f.title ? ' · title' : '') + '</span>';
    pit.appendChild(mark); f.mark = mark;
  });

  // Silence for the first 14% of the act, then four windows, then a hold.
  var START = 0.14, WIN = 0.17;
  var lastKey = '';
  function updateFlights() {
    var p = reduce ? 1 : actP(flightsAct);
    var live = -1;
    FLIGHTS.forEach(function (f, i) {
      var k = Math.max(0, Math.min(1, (p - START - i * WIN) / (WIN * 0.86)));
      f.path.style.strokeDashoffset = (f.len * (1 - k)).toFixed(1);
      f.path.style.strokeDasharray = k >= 1 ? '6 7' : f.len;
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
    if (live < 0) { meet = 'On the board'; dist = '0.00 m'; }
    else {
      var f = FLIGHTS[live];
      meet = f.meet; dist = (f.d * f.k).toFixed(2) + ' m';
    }
    key = meet + dist;
    if (key !== lastKey) { meetEl.textContent = meet; distEl.textContent = dist; lastKey = key; }
  }

  // ---- one loop ------------------------------------------------------------
  function frame() {
    updateRoute();
    updateFlights();
    if (!reduce) { mx += (tx - mx) * 0.08; takeoff.style.setProperty('--mx', mx.toFixed(3)); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- contact: the parent's address never ships. Messages go to a relay. --
  var form = document.querySelector('[data-contact]');
  var status = form.querySelector('[data-contact-status]');
  var send = form.querySelector('button[type=submit]');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var missing = [].slice.call(form.querySelectorAll('[required]')).find(function (f) { return !f.value.trim(); });
    if (missing) { status.textContent = 'Please add ' + missing.placeholder.toLowerCase() + '.'; missing.focus(); return; }
    var email = form.querySelector('[type=email]');
    if (!email.validity.valid) { status.textContent = 'That email address looks incomplete. Check it and send again.'; email.focus(); return; }
    var key = form.getAttribute('data-access-key');
    if (!key) { status.textContent = 'The contact form is being connected and is not sending yet. Please try again soon.'; return; }
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
