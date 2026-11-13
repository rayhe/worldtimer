/* World Timer — vector watch engine.
   Draws a Cottier-style world timer as resolution-independent SVG and animates it:
     earth frame  = city ring + north-polar map (rigid; turns when the home city changes)
     ring frame   = 24-hour ring, fixed to the sun (noon always faces the subsolar meridian)
   Used by the Heritage, Chrono, Atelier and Nocturne pages with different configs. */
(function () {
  'use strict';
  var WT = window.WT, NS = 'http://www.w3.org/2000/svg', D2R = Math.PI / 180, seq = 0;

  function E(tag, a, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n) { return Math.round(n * 100) / 100; }
  function pol(r, A) { A *= D2R; return [f(r * Math.sin(A)), f(-r * Math.cos(A))]; }   // A = clock angle
  function P() { return 'M' + [].map.call(arguments, function (p) { return f(p[0]) + ' ' + f(p[1]); }).join('L') + 'Z'; }
  function wedge(r0, r1, a0, a1) {
    var p0 = pol(r1, a0), p1 = pol(r1, a1), p2 = pol(r0, a1), p3 = pol(r0, a0);
    return 'M' + p0 + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + p1 + (r0 > 0 ? 'L' + p2 + 'A' + r0 + ' ' + r0 + ' 0 0 0 ' + p3 : 'L0 0') + 'Z';
  }
  function arc(r, a0, a1) { var p0 = pol(r, a0), p1 = pol(r, a1); return 'M' + p0 + 'A' + r + ' ' + r + ' 0 0 ' + (a1 > a0 ? 1 : 0) + ' ' + p1; }
  function ringPath(r0, r1) { return 'M' + r1 + ' 0A' + r1 + ' ' + r1 + ' 0 1 0 ' + (-r1) + ' 0A' + r1 + ' ' + r1 + ' 0 1 0 ' + r1 + ' 0ZM' + r0 + ' 0A' + r0 + ' ' + r0 + ' 0 1 1 ' + (-r0) + ' 0A' + r0 + ' ' + r0 + ' 0 1 1 ' + r0 + ' 0Z'; }
  function mod(a, n) { return ((a % n) + n) % n; }

  var mctx = document.createElement('canvas').getContext('2d');
  var CONDENSED = '"Avenir Next Condensed","DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow","Liberation Sans Narrow","Helvetica Neue",Arial,sans-serif';
  var SANS = '"Avenir Next","Helvetica Neue","Segoe UI",Roboto,Arial,sans-serif';
  var SERIF = '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,"Times New Roman",serif';

  // ---------- finishes ----------
  var CASES = WT.CASES = {
    steel: ['#fbfcfd', '#aab0b8', '#5d636c', '#24272c'],
    gold: ['#fff4cf', '#dcb85f', '#9c7522', '#4f380b'],
    rose: ['#ffe6d9', '#dba086', '#a5644d', '#522819'],
    black: ['#74777d', '#303236', '#18191c', '#040405'],
    bronze: ['#f0cfa0', '#b98852', '#7a5228', '#33200c']
  };
  var DIALS = WT.DIALS = {
    navy: { dial0: '#4a8ec4', dial1: '#0c3556', ink: '#ffffff', cityBg: '#17191d', cityInk: '#cfd3d9', ocean0: '#2f72a8', ocean1: '#0b2c4a', land: '#86a86f', landEdge: '#e7efd9', grat: 'rgba(255,255,255,.17)', hand: '#f3f5f7', lume: '#e6f3d4', accent: '#1e90ff', sec: '#ffffff', burst: 0.10 },
    ivory: { dial0: '#fdfaf1', dial1: '#e7dec8', ink: '#1d2430', cityBg: '#f4eede', cityInk: '#2a2f3a', ocean0: '#e3ecf0', ocean1: '#bdd1dc', land: '#cdbd92', landEdge: '#7d6c45', grat: 'rgba(40,50,70,.2)', hand: '#22408f', lume: '#f6f2e1', accent: '#b3261e', sec: '#b3261e', burst: 0 },
    noir: { dial0: '#2b2d32', dial1: '#090a0c', ink: '#f1f1ee', cityBg: '#0c0d0f', cityInk: '#c9cbd0', ocean0: '#1c1e22', ocean1: '#0b0c0e', land: '#5b5e64', landEdge: '#c3c6cc', grat: 'rgba(255,255,255,.11)', hand: '#f1f1ee', lume: '#dcf5cd', accent: '#ff5a1f', sec: '#ff5a1f', burst: 0.07 },
    salmon: { dial0: '#f4bda4', dial1: '#c98062', ink: '#2b2320', cityBg: '#272120', cityInk: '#ecd9cf', ocean0: '#eeb096', ocean1: '#cb8667', land: '#f9dccc', landEdge: '#7a4630', grat: 'rgba(60,30,20,.22)', hand: '#2b2320', lume: '#fff3e6', accent: '#2f5d8a', sec: '#2f5d8a', burst: 0.15 },
    forest: { dial0: '#2f7a5c', dial1: '#0c3626', ink: '#f6f1e3', cityBg: '#10241c', cityInk: '#d5e2d6', ocean0: '#236a50', ocean1: '#0c3526', land: '#c8b571', landEdge: '#f1e6b8', grat: 'rgba(255,255,255,.15)', hand: '#f1dfa6', lume: '#f3f0cf', accent: '#f2c14e', sec: '#f2c14e', burst: 0.15 },
    silver: { dial0: '#f1f3f5', dial1: '#bcc1c9', ink: '#1b2028', cityBg: '#e1e4e8', cityInk: '#252a33', ocean0: '#d3dae2', ocean1: '#adb7c3', land: '#8d95a0', landEdge: '#f6f7f8', grat: 'rgba(20,30,50,.17)', hand: '#1b2028', lume: '#f3f6ea', accent: '#0b6bcb', sec: '#d03a2b', burst: 0.17 }
  };
  var HAND_FINISH = WT.HAND_FINISH = { steel: '#f3f5f7', blued: '#22408f', gold: '#e3c16a', rose: '#dba086', black: '#1b1d21', white: '#ffffff' };
  WT.HANDS = ['baton', 'dauphine', 'sword', 'syringe', 'alpha', 'leaf', 'breguet', 'skeleton'];
  WT.INDICES = ['arabic', 'roman', 'baton', 'dots', 'field', 'none'];
  WT.MAPS = ['relief', 'engraved', 'outline', 'none'];
  WT.MOTIONS = ['sweep', 'hz4', 'hz5', 'tick'];

  var DEF = {
    case: 'steel', dial: 'navy', hands: 'baton', handFinish: 'auto', indices: 'arabic', numerals: 'sans', map: 'relief',
    ring: 'sky', motion: 'sweep', seconds: true, track: 'ticks', pushers: false, glow: false, mapR: 216, skipIdx: [],
    interactive: true, tapLapse: true
  };

  // ---------- hands (drawn pointing to 12; L = length, W = half width, T = tail) ----------
  function handShape(style, L, W, T) {
    var s = -L * 0.74;
    switch (style) {
      case 'dauphine': return { d: P([0, -L], [W, 0], [0, T], [-W, 0]), facet: P([0, -L], [W, 0], [0, T]) };
      case 'sword': return { d: P([-W * 0.4, T], [-W, s], [0, -L], [W, s], [W * 0.4, T]), lume: P([-W * 0.18, -L * 0.2], [-W * 0.58, s * 0.985], [0, -L * 0.92], [W * 0.58, s * 0.985], [W * 0.18, -L * 0.2]) };
      case 'syringe': var w = W * 0.62; return { d: P([-w, T], [-w, -L * 0.72], [-1.5, -L * 0.77], [-1.5, -L], [1.5, -L], [1.5, -L * 0.77], [w, -L * 0.72], [w, T]), lume: P([-w * 0.5, -L * 0.2], [-w * 0.5, -L * 0.69], [w * 0.5, -L * 0.69], [w * 0.5, -L * 0.2]) };
      case 'alpha': return { d: P([-3, T], [-3, -L * 0.1], [-W, -L * 0.17], [0, -L], [W, -L * 0.17], [3, -L * 0.1], [3, T]), lume: P([-W * 0.52, -L * 0.21], [0, -L * 0.85], [W * 0.52, -L * 0.21]) };
      case 'leaf': return { d: 'M0 ' + T + 'C' + f(-W * 0.9) + ' ' + f(T * 0.2) + ' ' + f(-W * 1.75) + ' ' + f(-L * 0.5) + ' 0 ' + (-L) + 'C' + f(W * 1.75) + ' ' + f(-L * 0.5) + ' ' + f(W * 0.9) + ' ' + f(T * 0.2) + ' 0 ' + T + 'Z',
        facet: 'M0 ' + T + 'L0 ' + (-L) + 'C' + f(W * 1.75) + ' ' + f(-L * 0.5) + ' ' + f(W * 0.9) + ' ' + f(T * 0.2) + ' 0 ' + T + 'Z' };
      case 'breguet': var cy = -L * 0.72, ro = W * 1.15, ri = W * 0.72, ic = cy - ro * 0.14;
        return { evenodd: true, d: P([-4, T], [-2.5, cy + ro * 0.85], [2.5, cy + ro * 0.85], [4, T]) +
          'M0 ' + f(cy - ro) + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 0 ' + f(cy + ro) + 'A' + f(ro) + ' ' + f(ro) + ' 0 1 1 0 ' + f(cy - ro) + 'Z' +
          'M0 ' + f(ic - ri) + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 0 ' + f(ic + ri) + 'A' + f(ri) + ' ' + f(ri) + ' 0 1 0 0 ' + f(ic - ri) + 'Z' +
          P([-2.3, cy - ro * 0.9], [-0.8, -L], [0.8, -L], [2.3, cy - ro * 0.9]) };
      case 'skeleton': return { evenodd: true, d: P([-W * 0.4, T], [-W, s], [0, -L], [W, s], [W * 0.4, T]) + P([-W * 0.12, -L * 0.2], [-W * 0.56, s * 0.985], [0, -L * 0.9], [W * 0.56, s * 0.985], [W * 0.12, -L * 0.2]) };
      default: var b = W * 0.52;   // baton
        return { d: 'M' + f(-b) + ' ' + T + 'L' + f(-b) + ' ' + f(-L + 3) + 'Q' + f(-b) + ' ' + (-L) + ' ' + f(-b + 3) + ' ' + (-L) + 'L' + f(b - 3) + ' ' + (-L) + 'Q' + f(b) + ' ' + (-L) + ' ' + f(b) + ' ' + f(-L + 3) + 'L' + f(b) + ' ' + T + 'Z',
          lume: P([-b * 0.5, -L * 0.24], [-b * 0.5, -L + 7], [b * 0.5, -L + 7], [b * 0.5, -L * 0.24]) };
    }
  }
  WT.handShape = handShape;

  // ---------- north-polar azimuthal map ----------
  var LAT_MIN = -58;
  function proj(R, lat, lon) {
    var r = R * Math.min(1.25, (90 - lat) / (90 - LAT_MIN)), l = lon * D2R;
    return [-r * Math.sin(l), -r * Math.cos(l)];             // east runs counter-clockwise seen from above the pole
  }
  var landCache = {};
  function landPath(R) {
    if (landCache[R]) return landCache[R];
    var d = '';
    (window.WT_LAND || []).forEach(function (ring) {
      var out = [], any = false;
      ring.forEach(function (p) { if (p[1] > LAT_MIN - 2) any = true; var q = proj(R, p[1], p[0]); out.push(f(q[0]) + ' ' + f(q[1])); });
      if (any) d += 'M' + out.join('L') + 'Z';
    });
    return (landCache[R] = d);
  }
  /** Outline of the region where the sun is more than `depth` degrees below the horizon. */
  function nightPath(R, sun, depth) {
    var a = -sun.lat * D2R, b = sun.lon + 180, rho = (90 - depth) * D2R, d = '', sa = Math.sin(a), ca = Math.cos(a);
    for (var i = 0; i < 120; i++) {
      var be = i * 3 * D2R, sl = sa * Math.cos(rho) + ca * Math.sin(rho) * Math.cos(be);
      var lat = Math.asin(sl) / D2R, lon = b + Math.atan2(Math.sin(be) * Math.sin(rho) * ca, Math.cos(rho) - sa * sl) / D2R;
      var q = proj(R, Math.max(lat, LAT_MIN - 40), lon);
      d += (i ? 'L' : 'M') + f(q[0]) + ' ' + f(q[1]);
    }
    d += 'Z';
    if (sun.lat > depth) { var o = R * 1.4; d += 'M' + o + ' 0A' + o + ' ' + o + ' 0 1 0 ' + (-o) + ' 0A' + o + ' ' + o + ' 0 1 0 ' + o + ' 0Z'; }   // cap holds the south pole
    return d;
  }

  WT.createWatch = function (host, opts) {
    var cfg = {}, k;
    for (k in DEF) cfg[k] = DEF[k];
    for (k in opts) cfg[k] = opts[k];
    var uid = 'wt' + (++seq), U = function (s) { return uid + s; }, url = function (s) { return 'url(#' + uid + s + ')'; };
    var listeners = {}, G = {}, svg, tip, glowItems = [], cityEls = [], numEls = [], zones = null, zoneBucket = -1;
    var st = {
      home: null, off: 0, mOff: 0, drag: null, lapse: null, resetting: false, lastTp: 0, sunKey: null, skyKey: null,
      hA: 0, mA: 0, sA: 0, ringA: 0, earthA: 0, ms: 0
    };
    host.classList.add('wt');
    function emit(n, a, b) { (listeners[n] || []).forEach(function (fn) { fn(a, b); }); }

    // ----- home city -----
    var localTz = WT.localTz();
    st.home = cfg.home || WT.cityFor(localTz);
    st.off = WT.offsetMin(st.home.tz, WT.now()) / 60;
    st.mOff = mod(st.off * 60, 60);
    function setHome(city, instant) {
      if (!city) return;
      st.home = city; st.skyKey = null; st.sunKey = null;
      if (instant) { st.off = WT.offsetMin(city.tz, WT.now()) / 60; st.mOff = mod(st.off * 60, 60); }
      if (zones) refreshZones(WT.now(), true);
      markHome(); emit('home', city);
    }
    function step(dir) {            // next whole-hour zone east (+1) or west (-1), like the pusher on a Cottier world timer
      var cur = WT.wrapOff(WT.offsetMin(st.home.tz, WT.now()) / 60), best = null, bd = 99;
      zones.ring.forEach(function (e) { var d = mod((e.slot - cur) * dir, 24); if (d > 1e-6 && d < bd) { bd = d; best = e; } });
      if (best) setHome(best.city);
    }

    // ----- build -----
    function build() {
      var D = DIALS[cfg.dial] || DIALS.navy, C = CASES[cfg.case] || CASES.steel;
      var handCol = cfg.handFinish !== 'auto' && HAND_FINISH[cfg.handFinish] ? HAND_FINISH[cfg.handFinish] : D.hand;
      host.querySelectorAll('svg.wt-svg').forEach(function (n) { n.remove(); });
      glowItems = []; cityEls = []; numEls = []; G = {}; st.sunKey = st.skyKey = null; zoneBucket = -1;
      svg = E('svg', { viewBox: '-560 -560 1120 1120', class: 'wt-svg', role: 'img', 'aria-label': 'World timer watch' });
      svg.style.cssText = '--dial0:' + D.dial0 + ';--dial1:' + D.dial1 + ';--ink:' + D.ink + ';--cityBg:' + D.cityBg + ';--cityInk:' + D.cityInk +
        ';--ocean0:' + D.ocean0 + ';--ocean1:' + D.ocean1 + ';--land:' + D.land + ';--landEdge:' + D.landEdge + ';--grat:' + D.grat +
        ';--hand:' + handCol + ';--lume:' + D.lume + ';--accent:' + D.accent + ';--sec:' + D.sec + ';--c0:' + C[0] + ';--c1:' + C[1] + ';--c2:' + C[2] + ';--c3:' + C[3];
      var defs = E('defs', {}, svg), i, g, t, p;
      function grad(type, id, attrs, stops) {
        var gr = E(type, attrs, defs); gr.id = U(id);
        stops.forEach(function (s) { var e = E('stop', { offset: s[0] }, gr); e.style.stopColor = s[1]; if (s[2] != null) e.style.stopOpacity = s[2]; });
      }
      grad('radialGradient', 'dial', { cx: '50%', cy: '42%', r: '62%' }, [[0, 'var(--dial0)'], [1, 'var(--dial1)']]);
      grad('radialGradient', 'ocean', { cx: '42%', cy: '36%', r: '70%' }, [[0, 'var(--ocean0)'], [1, 'var(--ocean1)']]);
      grad('radialGradient', 'vig', { cx: '50%', cy: '50%', r: '50%' }, [[0.72, '#000', 0], [1, '#000', 0.42]]);
      grad('radialGradient', 'shadow', { cx: '50%', cy: '50%', r: '50%' }, [[0.80, '#000', 0.38], [1, '#000', 0]]);
      grad('linearGradient', 'metal', { x1: 0, y1: 0, x2: 1, y2: 1 }, [[0, 'var(--c0)'], [0.45, 'var(--c1)'], [1, 'var(--c2)']]);
      grad('linearGradient', 'metalR', { x1: 1, y1: 1, x2: 0, y2: 0 }, [[0, 'var(--c0)'], [0.5, 'var(--c1)'], [1, 'var(--c3)']]);
      grad('linearGradient', 'knurl', { x1: 0, y1: 0, x2: 0, y2: 1 }, [[0, 'var(--c2)'], [0.3, 'var(--c0)'], [0.55, 'var(--c1)'], [1, 'var(--c3)']]);
      grad('radialGradient', 'glare', { cx: '50%', cy: '50%', r: '50%' }, [[0, '#fff', 0.55], [1, '#fff', 0]]);
      E('circle', { r: cfg.mapR }, E('clipPath', { id: U('mapclip') }, defs));
      E('circle', { r: 466 }, E('clipPath', { id: U('glassclip') }, defs));
      if (cfg.glow) {
        var fl = E('filter', { id: U('bloom'), x: '-10%', y: '-10%', width: '120%', height: '120%' }, defs);
        E('feGaussianBlur', { stdDeviation: 7, result: 'b' }, fl);
        var mg = E('feMerge', {}, fl); E('feMergeNode', { in: 'b' }, mg); E('feMergeNode', { in: 'b' }, mg); E('feMergeNode', { in: 'SourceGraphic' }, mg);
      }

      // --- case ---
      E('circle', { cy: 16, r: 548, fill: url('shadow') }, svg);
      G.case = E('g', { class: 'wt-case' }, svg);
      function pusher(A, name, wd, len, label) {
        var pg = E('g', { transform: 'rotate(' + A + ')', class: 'wt-pusher', 'data-p': name, tabindex: cfg.interactive ? 0 : null, role: 'button', 'aria-label': label }, G.case);
        var inner = E('g', {}, pg);
        E('rect', { x: -wd / 2 + 5, y: -506, width: wd - 10, height: 14, fill: 'var(--c3)' }, inner);
        E('rect', { x: -wd / 2, y: -500 - len, width: wd, height: len - 2, rx: 5, fill: url('knurl'), stroke: 'var(--c3)', 'stroke-width': 1.2 }, inner);
        E('title', {}, pg).textContent = label;
        return pg;
      }
      // crown at 3 o'clock, knurled
      var cr = E('g', { class: 'wt-pusher wt-crown', 'data-p': 'crown', tabindex: cfg.interactive ? 0 : null, role: 'button', 'aria-label': 'Crown: return to the current time' }, G.case);
      var cri = E('g', {}, cr);
      E('rect', { x: 494, y: -15, width: 16, height: 30, fill: 'var(--c3)' }, cri);
      E('rect', { x: 506, y: -36, width: 44, height: 72, rx: 7, fill: url('knurl'), stroke: 'var(--c3)', 'stroke-width': 1.2 }, cri);
      for (i = 0; i < 9; i++) E('line', { x1: 510, x2: 546, y1: -30 + i * 7.5, y2: -30 + i * 7.5, stroke: 'var(--c3)', 'stroke-width': 1.4, opacity: 0.55 }, cri);
      E('title', {}, cr).textContent = 'Crown: back to now';
      pusher(-60, 'zone', 46, 30, 'Zone pusher: advance to the next city east');
      if (cfg.pushers) { pusher(60, 'start', 50, 36, 'Start / stop'); pusher(120, 'reset', 50, 36, 'Split / reset'); }
      // bezel: wedges of brushed metal with two polished highlights
      for (i = 0; i < 120; i++) {
        var th = i * 3 + 1.5, lobe = Math.pow(0.5 + 0.5 * Math.cos(2 * (th + 42) * D2R), 2.2);
        E('path', { d: wedge(464, 500, i * 3 - 0.2, i * 3 + 3.2), fill: WT.mix(lobe > 0.5 ? C[1] : C[2], lobe > 0.5 ? C[0] : C[1], lobe > 0.5 ? (lobe - 0.5) * 2 : lobe * 2) }, G.case);
      }
      E('circle', { r: 500, fill: 'none', stroke: 'var(--c3)', 'stroke-width': 1.5, opacity: 0.8 }, G.case);
      E('circle', { r: 482, fill: 'none', stroke: url('metal'), 'stroke-width': 1.5, opacity: 0.6 }, G.case);
      E('circle', { r: 465, fill: 'none', stroke: 'var(--c3)', 'stroke-width': 3 }, G.case);

      // --- earth frame: city ring ---
      G.earth = E('g', { class: 'wt-earth' }, svg);
      E('path', { d: ringPath(386, 464), fill: 'var(--cityBg)', 'fill-rule': 'evenodd', class: 'wt-cityring' }, G.earth);
      E('circle', { r: 463, fill: 'none', stroke: '#000', 'stroke-width': 5, opacity: 0.22 }, G.earth);
      G.cities = E('g', { class: 'wt-cities', 'font-family': CONDENSED }, G.earth);

      // --- sun frame: 24 hour ring ---
      G.ring = E('g', { class: 'wt-ring24' }, svg);
      G.sky = E('g', {}, G.ring);
      for (i = 0; i < 96; i++) E('path', { d: wedge(322, 385, -(i + 1) * 3.75 - 0.15, -i * 3.75 + 0.15) }, G.sky);   // segment i covers hours i/4 .. (i+1)/4
      E('circle', { r: 385, fill: 'none', stroke: '#000', 'stroke-width': 2, opacity: 0.45 }, G.ring);
      G.nums = E('g', { 'font-family': SANS, 'font-weight': 700, 'font-size': 27, 'text-anchor': 'middle' }, G.ring);
      for (i = 0; i < 24; i++) {
        t = E('text', { id: U('n' + i), y: 9.5, class: 'wt-num' }, G.nums); t.textContent = WT.pad(i);
        numEls.push({ el: t, h: i, flip: null });
      }
      // home pointer
      G.pointer = E('path', { id: U('ptr'), d: 'M-13 -402L13 -402L0 -380Z', fill: 'var(--accent)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1, class: 'wt-pointer' }, svg);

      // --- dial ---
      G.dial = E('g', { class: 'wt-dial' }, svg);
      E('circle', { r: 321, fill: url('dial') }, G.dial);
      if (D.burst) {
        G.burst = E('g', { class: 'wt-burst' }, G.dial);
        for (i = 0; i < 90; i++) {
          var c2 = Math.cos((i * 4 + 2) * D2R), v = Math.pow(Math.abs(c2), 3) * D.burst * (1 + 0.35 * Math.sin(i * 12.9898) * Math.sin(i * 4.1));
          E('path', { d: wedge(0, 321, i * 4 - 0.1, i * 4 + 4.1), fill: c2 > 0 ? '#fff' : '#000', opacity: f(Math.max(0, c2 > 0 ? v * 1.5 : v)) }, G.burst);
        }
      }
      E('circle', { r: 321, fill: url('vig'), opacity: 0.55 }, G.dial);
      E('circle', { r: 321.5, fill: 'none', stroke: url('metalR'), 'stroke-width': 3 }, G.dial);
      // minute track
      G.track = E('g', { stroke: 'var(--ink)', class: 'wt-track' }, G.dial);
      if (cfg.track === 'railroad') { E('circle', { r: 314, fill: 'none', 'stroke-width': 1.3 }, G.track); E('circle', { r: 300, fill: 'none', 'stroke-width': 1.3 }, G.track); }
      for (i = 0; i < 60; i++) {
        var maj = i % 5 === 0, a0 = pol(cfg.track === 'railroad' ? 300 : (maj ? 296 : 302), i * 6), a1 = pol(314, i * 6);
        E('line', { x1: a0[0], y1: a0[1], x2: a1[0], y2: a1[1], 'stroke-width': maj ? 3.2 : 1.4, opacity: maj ? 0.95 : 0.6 }, G.track);
      }
      // hour indices
      G.idx = E('g', { class: 'wt-idx' }, G.dial);
      var ROM = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
      for (i = 0; i < 12; i++) {
        if (cfg.skipIdx.indexOf(i) >= 0) continue;
        var A = i * 30, kind = cfg.indices, id = U('i' + i), lumeEl = null;
        if (kind === 'field') kind = (i === 0) ? 'tri' : (i % 3 === 0 ? 'arabic' : 'baton');
        if (kind === 'dots') kind = (i === 0) ? 'tri' : (i % 3 === 0 ? 'baton' : 'dot');
        if (kind === 'arabic') {
          p = pol(258, A);
          t = E('text', { id: id, x: p[0], y: p[1] + (cfg.numerals === 'serif' ? 17 : 16), 'text-anchor': 'middle', 'font-size': cfg.numerals === 'serif' ? 52 : 46, 'font-weight': cfg.numerals === 'serif' ? 400 : 600, 'font-family': cfg.numerals === 'serif' ? SERIF : SANS, fill: 'var(--ink)', class: 'wt-numeral' }, G.idx);
          t.textContent = i || 12; lumeEl = t;
        } else if (kind === 'roman') {
          t = E('text', { id: id, y: -238, 'text-anchor': 'middle', 'font-size': 46, 'font-family': SERIF, fill: 'var(--ink)', transform: 'rotate(' + A + ')', class: 'wt-numeral' }, G.idx);
          t.textContent = ROM[i]; lumeEl = t;
        } else if (kind === 'baton') {
          g = E('g', { transform: 'rotate(' + A + ')' }, G.idx);
          var bw = i === 0 ? 20 : 12;
          E('rect', { x: -bw / 2, y: -288, width: bw, height: 54, rx: 1.5, fill: 'var(--hand)', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 1 }, g);
          E('rect', { x: 0, y: -288, width: bw / 2, height: 54, fill: 'rgba(0,0,0,.14)' }, g);
          lumeEl = E('rect', { id: id, x: -bw / 2 + 3, y: -284, width: bw - 6, height: 46, rx: 1, fill: 'var(--lume)', class: 'lume', transform: 'rotate(' + A + ')' }, G.idx);
        } else if (kind === 'dot') {
          p = pol(266, A); E('circle', { cx: p[0], cy: p[1], r: 12.5, fill: 'var(--hand)', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 1 }, G.idx);
          lumeEl = E('circle', { id: id, cx: p[0], cy: p[1], r: 9, fill: 'var(--lume)', class: 'lume' }, G.idx);
        } else if (kind === 'tri') {
          E('path', { d: 'M-21 -290L21 -290L0 -238Z', fill: 'var(--hand)', stroke: 'rgba(0,0,0,.4)', 'stroke-width': 1 }, G.idx);
          lumeEl = E('path', { id: id, d: 'M-14 -286L14 -286L0 -250Z', fill: 'var(--lume)', class: 'lume' }, G.idx);
        }
        if (lumeEl) glow(lumeEl, 'fixed', 262, A);
      }

      // --- map (earth frame) ---
      G.map = E('g', { class: 'wt-map wt-map-' + cfg.map }, svg);
      if (cfg.map !== 'none') {
        var R = cfg.mapR, mc = E('g', { 'clip-path': url('mapclip') }, G.map);
        if (cfg.map === 'relief') E('circle', { r: R, fill: url('ocean') }, mc);
        else E('circle', { r: R, fill: 'var(--ink)', opacity: 0.045 }, mc);
        var gr = E('g', { fill: 'none', stroke: 'var(--grat)', 'stroke-width': 1 }, mc);
        [60, 30, 0, -30].forEach(function (la) { E('circle', { r: f(R * (90 - la) / (90 - LAT_MIN)), 'stroke-dasharray': la === 0 ? '5 5' : null }, gr); });
        for (i = 0; i < 24; i++) { p = pol(R, i * 15); var p0 = pol(R * 0.1, i * 15); E('line', { x1: p0[0], y1: p0[1], x2: p[0], y2: p[1] }, gr); }
        E('path', {
          id: U('land'), d: landPath(R), class: 'wt-land',
          fill: cfg.map === 'relief' ? 'var(--land)' : cfg.map === 'engraved' ? 'var(--ink)' : 'none', 'fill-opacity': cfg.map === 'engraved' ? 0.2 : 1,
          stroke: cfg.map === 'relief' ? 'var(--landEdge)' : 'var(--ink)', 'stroke-width': cfg.map === 'outline' ? 1.5 : 0.9, 'stroke-opacity': cfg.map === 'relief' ? 0.75 : 0.7, 'stroke-linejoin': 'round'
        }, mc);
        G.night = [0, 6, 12].map(function () { return E('path', { fill: '#050b20', 'fill-opacity': cfg.map === 'relief' ? 0.27 : 0.2, 'fill-rule': 'evenodd' }, mc); });
        G.hot = E('circle', { r: 6, fill: '#fff', stroke: 'var(--accent)', 'stroke-width': 3, display: 'none' }, mc);
        G.homeDot = E('circle', { r: 5, fill: 'var(--accent)', stroke: '#fff', 'stroke-width': 1.6 }, mc);
        E('circle', { r: R, fill: url('vig'), opacity: 0.8 }, mc);
        E('circle', { r: R, fill: 'none', stroke: url('metalR'), 'stroke-width': 3.5 }, G.map);
        E('circle', { r: R + 2.5, fill: 'none', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 1.5 }, G.map);
      }
      G.sub = E('g', { class: 'wt-sub' }, svg);          // pages add sub-dials here

      // --- hands ---
      G.hands = E('g', { class: 'wt-hands' }, svg);
      function hand(name, L, W, T, frame) {
        var sh = handShape(cfg.hands, L, W, T);
        var shadow = E('g', { transform: 'translate(4 7)', opacity: 0.28 }, G.hands), sg = E('g', {}, shadow);
        E('path', { d: sh.d, 'fill-rule': sh.evenodd ? 'evenodd' : null }, sg);
        var hg = E('g', { class: 'wt-hand wt-hand-' + name }, G.hands);
        E('path', { d: sh.d, fill: 'var(--hand)', 'fill-rule': sh.evenodd ? 'evenodd' : null, stroke: 'rgba(0,0,0,.45)', 'stroke-width': 0.9, 'stroke-linejoin': 'round' }, hg);
        if (sh.facet) E('path', { d: sh.facet, fill: 'rgba(0,0,0,.22)' }, hg);
        if (sh.lume) glow(E('path', { id: U('h' + name), d: sh.lume, fill: 'var(--lume)', class: 'lume' }, hg), frame, L * 0.55, 0);
        return [hg, sg];
      }
      G.h = hand('hour', 196, 15, 26, 'h');
      G.m = hand('minute', 290, 11, 34, 'm');
      G.over = E('g', { class: 'wt-over' }, svg);         // pages add extra hands here (chronograph)
      if (cfg.seconds) {
        var ss = E('g', { transform: 'translate(4 8)', opacity: 0.25 }, G.over), ssg = E('g', {}, ss);
        E('path', { d: P([-1.6, 78], [-0.7, -304], [0.7, -304], [1.6, 78]) }, ssg);
        var sg2 = E('g', { class: 'wt-hand wt-hand-second' }, G.over);
        E('path', { d: P([-2.2, 78], [-0.8, -304], [0.8, -304], [2.2, 78]), fill: 'var(--sec)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.6 }, sg2);
        E('rect', { x: -4.5, y: 40, width: 9, height: 40, rx: 3, fill: 'var(--sec)', stroke: 'rgba(0,0,0,.35)', 'stroke-width': 0.6 }, sg2);
        glow(E('circle', { id: U('hsec'), cy: -236, r: 6.5, fill: 'var(--lume)', stroke: 'var(--sec)', 'stroke-width': 2, class: 'lume' }, sg2), 's', 236, 0);
        G.s = [sg2, ssg];
      }
      E('circle', { r: 13, fill: url('metal'), stroke: 'rgba(0,0,0,.5)', 'stroke-width': 1 }, G.over);
      E('circle', { r: 4.5, fill: 'var(--c3)' }, G.over);

      // --- glow layer (Nocturne): mirrors every lume element so it can shine above a darkness overlay ---
      if (cfg.glow) {
        G.dark = E('g', { class: 'wt-dark' }, svg);
        G.glow = E('g', { class: 'wt-glow', filter: url('bloom') }, svg);
        G.gf = {};
        ['fixed', 'earth', 'ring', 'h', 'm', 's'].forEach(function (fr) { G.gf[fr] = E('g', {}, G.glow); });
        G.gfMap = E('g', { 'clip-path': url('mapclip') }, G.gf.earth);
        glowItems.forEach(function (it) { it.use = E('use', { href: '#' + it.id, opacity: 0 }, it.frame === 'land' ? G.gfMap : G.gf[it.frame]); });
        if (G.map && cfg.map !== 'none') { var li = { id: U('land'), frame: 'land', r: 0, a: 0 }; li.use = E('use', { href: '#' + li.id, opacity: 0, class: 'wt-glow-land' }, G.gfMap); glowItems.push(li); }
        var pi = { id: U('ptr'), frame: 'fixed', r: 392, a: 0 }; pi.use = E('use', { href: '#' + pi.id, opacity: 0 }, G.gf.fixed); glowItems.push(pi);
      }
      // --- crystal ---
      G.glass = E('g', { 'clip-path': url('glassclip'), class: 'wt-glass', 'pointer-events': 'none' }, svg);
      G.glare = E('ellipse', { cx: -150, cy: -230, rx: 360, ry: 210, fill: url('glare'), opacity: 0.16, transform: 'rotate(-28)' }, G.glass);
      E('ellipse', { cx: 210, cy: 300, rx: 260, ry: 120, fill: url('glare'), opacity: 0.05, transform: 'rotate(-28)' }, G.glass);

      host.insertBefore(svg, host.firstChild);
      if (!tip) { tip = document.createElement('div'); tip.className = 'wt-tip'; tip.setAttribute('role', 'status'); host.appendChild(tip); }
      numEls.forEach(function (n) { if (cfg.glow) glow(n.el, 'ring', 353, -n.h * 15, true); });
      refreshZones(WT.now(), true);
      if (cfg.interactive) bind();
      emit('build');
    }
    function glow(el, frame, r, a, late) {
      if (!cfg.glow) return;
      var it = { id: el.id, frame: frame, r: r, a: a };
      if (late) it.use = E('use', { href: '#' + it.id, opacity: 0 }, G.gf[frame]);
      glowItems.push(it);
    }

    // ----- city ring -----
    function refreshZones(ms, force) {
      var b = Math.floor(ms / 900000);
      if (!force && b === zoneBucket) return;
      zoneBucket = b;
      var z = WT.zones(ms), hs = WT.wrapOff(WT.offsetMin(st.home.tz, ms) / 60);
      z.ring.concat(z.frac).forEach(function (e) {      // the home slot carries the home city's own name
        if (Math.abs(e.slot - hs) < 1e-6 && e.city.name !== st.home.name) {
          e.also = [e.city].concat((e.also || []).filter(function (c) { return c.name !== st.home.name; })); e.city = st.home;
        }
      });
      var key = z.ring.map(function (e) { return e.slot + e.city.name; }).join() + z.frac.map(function (e) { return e.slot + e.city.name; }).join();
      if (zones && zones.key === key && G.cities.firstChild) { markHome(); return; }
      zones = z; zones.key = key;
      while (G.cities.firstChild) G.cities.removeChild(G.cities.firstChild);
      if (cfg.glow) glowItems = glowItems.filter(function (it) { if (it.city) { it.use.remove(); return false; } return true; });
      cityEls = [];
      // measure every name, then squeeze them all alike (a synthetic condensed face) so each fits its 15 degree slot
      var FS = 22, LS = 1.6, MAXLEN = 97, rc = 430;
      mctx.font = '500 ' + FS + 'px ' + CONDENSED;
      var lay = z.ring.map(function (e) {
        var ch = e.city.name.toUpperCase().split(''), w = ch.map(function (c) { return mctx.measureText(c).width || FS * 0.6; }), x = [], tot = 0;
        w.forEach(function (cw, j) { x.push(tot + cw / 2); tot += cw + (j < w.length - 1 ? LS : 0); });
        return { ch: ch, w: w, tot: tot, x: x.map(function (v) { return v - tot / 2; }) };
      });
      var sorted = lay.map(function (l) { return l.tot; }).sort(function (a, b) { return a - b; });
      var common = WT.clamp(MAXLEN / sorted[Math.floor(sorted.length * 0.8)], 0.7, 1);
      lay.forEach(function (l) { l.sx = Math.min(common, MAXLEN / l.tot); l.fs = FS; if (l.sx < 0.6) { l.fs = FS * l.sx / 0.6; l.sx = 0.6; } });
      z.ring.forEach(function (e, i) {
        var A = -e.slot * 15;
        var tk0 = pol(387, A), tk1 = pol(396, A);
        E('line', { x1: tk0[0], y1: tk0[1], x2: tk1[0], y2: tk1[1], stroke: 'var(--cityInk)', 'stroke-width': 2, opacity: 0.55 }, G.cities);
        var g = E('g', { id: U('c' + i), class: 'wt-city', tabindex: cfg.interactive ? 0 : null, role: 'button', 'aria-label': e.city.name + ', set as home city' }, G.cities);
        E('path', { d: wedge(398, 462, A - 7.3, A + 7.3), fill: 'transparent', class: 'wt-hit' }, g);
        var L = lay[i], texts = [E('g', {}, g), E('g', {}, g)];
        L.w.forEach(function (cw, j) {       // one glyph at a time, so the squeeze works in every browser
          var th = (L.x[j] * L.sx * L.fs / FS / rc) / D2R, att = { 'font-size': f(L.fs), 'text-anchor': 'middle', fill: 'var(--cityInk)' };
          att.transform = 'rotate(' + f(A + th) + ') translate(0 ' + f(-(rc - L.fs * 0.36)) + ') scale(' + f(L.sx) + ' 1)';
          E('text', att, texts[0]).textContent = L.ch[j];                                             // tops outward
          att.transform = 'rotate(' + f(A - th) + ') translate(0 ' + f(-(rc + L.fs * 0.36)) + ') rotate(180) scale(' + f(L.sx) + ' 1)';
          E('text', att, texts[1]).textContent = L.ch[j];                                             // tops inward (lower half)
        });
        var rec = { g: g, a: texts[0], b: texts[1], e: e, A: A, flip: null };
        cityEls.push(rec);
        if (cfg.glow) { var it = { id: g.id, frame: 'earth', r: 430, a: A, city: true }; it.use = E('use', { href: '#' + g.id, opacity: 0 }, G.gf.earth); glowItems.push(it); }
      });
      z.frac.forEach(function (e) {
        var p = pol(391, -e.slot * 15);
        var g = E('g', { class: 'wt-city wt-pip', tabindex: cfg.interactive ? 0 : null, role: 'button', 'aria-label': e.city.name + ', set as home city' }, G.cities);
        E('circle', { cx: p[0], cy: p[1], r: 11, fill: 'transparent', class: 'wt-hit' }, g);
        E('circle', { cx: p[0], cy: p[1], r: 3.2, fill: 'var(--cityInk)' }, g);
        cityEls.push({ g: g, e: e, A: -e.slot * 15, pip: true });
      });
      markHome();
      emit('zones', zones);
    }
    function markHome() {
      if (!zones) return;
      var hs = WT.wrapOff(WT.offsetMin(st.home.tz, WT.now()) / 60);
      cityEls.forEach(function (c) { c.g.classList.toggle('home', Math.abs(c.e.slot - hs) < 1e-6); });
      if (G.homeDot) {
        var q = proj(cfg.mapR, st.home.lat, st.home.lon);
        G.homeDot.setAttribute('cx', f(q[0])); G.homeDot.setAttribute('cy', f(q[1]));
        G.homeDot.setAttribute('display', st.home.guessed || st.home.lat < LAT_MIN ? 'none' : null);
      }
    }

    // ----- tooltip -----
    function showTip(c, x, y) {
      var e = c.e, ms = WT.now(), l = WT.local(e.city.tz, ms), el = WT.elevation(WT.sun(ms), e.city.lat, e.city.lon);
      var also = (e.also || []).slice(0, 6).map(function (o) { return o.name; }).join(' · ');
      tip.innerHTML = '<b></b><span class="t"></span><span class="d"></span>' + (also ? '<span class="o"></span>' : '');
      tip.children[0].textContent = e.city.name;
      tip.children[1].textContent = WT.fmtTime(l) + (el > -0.8 ? '  ☀' : '  ☾');
      tip.children[2].textContent = WT.fmtDate(l.d, true) + ' · ' + WT.fmtOffset(e.off);
      if (also) tip.children[3].textContent = 'Also ' + also;
      var r = host.getBoundingClientRect();
      tip.style.left = WT.clamp(x - r.left, 80, r.width - 80) + 'px';
      tip.style.top = (y - r.top + 22) + 'px';
      tip.classList.add('on');
      if (G.hot) { var q = proj(cfg.mapR, e.city.lat, e.city.lon); G.hot.setAttribute('cx', f(q[0])); G.hot.setAttribute('cy', f(q[1])); G.hot.setAttribute('display', e.city.lat < LAT_MIN ? 'none' : null); }
    }
    function hideTip() { tip.classList.remove('on'); if (G.hot) G.hot.setAttribute('display', 'none'); }

    // ----- pointer / keyboard -----
    var bound = false;
    function pt(ev) {
      var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 1120 - 560, y = (ev.clientY - r.top) / r.height * 1120 - 560;
      return { x: x, y: y, r: Math.sqrt(x * x + y * y), a: Math.atan2(x, -y) / D2R };
    }
    function cityOf(target) {
      var g = target.closest && target.closest('.wt-city'); if (!g) return null;
      for (var i = 0; i < cityEls.length; i++) if (cityEls[i].g === g) return cityEls[i];
      return null;
    }
    function bind() {
      if (bound) return; bound = true;
      host.addEventListener('pointerdown', function (ev) {
        if (ev.button) return;
        var p = pt(ev), pu = ev.target.closest && ev.target.closest('.wt-pusher');
        if (pu) { st.drag = { kind: 'pusher', el: pu }; pu.classList.add('down'); return; }
        var kind = p.r > 500 ? null : p.r > 386 ? 'earth' : p.r > 322 ? 'ring' : 'dial';
        if (!kind) return;
        st.drag = { kind: kind, a: p.a, moved: 0, off0: st.off, city: cityOf(ev.target), x: ev.clientX, y: ev.clientY };
        try { host.setPointerCapture(ev.pointerId); } catch (e) { }
      });
      host.addEventListener('pointermove', function (ev) {
        var p = pt(ev);
        emit('pointer', p, ev);
        if (G.glare) G.glare.setAttribute('transform', 'translate(' + f(-p.x * 0.05) + ' ' + f(-p.y * 0.05) + ') rotate(-28)');
        var d = st.drag;
        if (!d || d.kind === 'pusher') { if (!d) { var c = cityOf(ev.target); if (c) showTip(c, ev.clientX, ev.clientY); else hideTip(); } return; }
        var da = mod(p.a - d.a + 180, 360) - 180; d.a = p.a; d.moved += Math.abs(da);
        if (d.moved < 2.5) return;
        hideTip(); host.classList.add('dragging');
        if (d.kind === 'earth') { st.off += da / 15; d.live = true; }
        else if (d.kind === 'ring') { cancelAnim(); WT.skew(WT.skew() + da / 15 * 3600000); emit('scrub'); }
      });
      var up = function (ev) {
        var d = st.drag; st.drag = null; host.classList.remove('dragging');
        if (!d) return;
        if (d.kind === 'pusher') { d.el.classList.remove('down'); if (ev.type === 'pointerup') press(d.el.getAttribute('data-p')); return; }
        if (d.moved >= 2.5) {
          if (d.kind === 'earth') {      // snap to the nearest zone
            var cur = WT.wrapOff(st.off), best = null, bd = 99;
            cityEls.forEach(function (c) { var dd = Math.abs(mod(c.e.slot - cur + 12, 24) - 12); if (dd < bd) { bd = dd; best = c; } });
            if (best) setHome(best.e.city);
          }
          return;
        }
        if (d.city) { hideTip(); setHome(d.city.e.city); }
        else { if (cfg.tapLapse && d.kind === 'dial') timelapse(); emit('tap', d.kind, ev); }
      };
      host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
      host.addEventListener('pointerleave', function () { if (!st.drag) hideTip(); });
      host.addEventListener('wheel', function (ev) {
        ev.preventDefault(); cancelAnim();
        var dm = (Math.abs(ev.deltaY) > Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX) * (ev.deltaMode ? 20 : 1) * (ev.shiftKey ? 6 : 0.6);
        WT.skew(WT.skew() + dm * 60000); emit('scrub');
      }, { passive: false });
      host.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter' && ev.key !== ' ') return;
        var c = cityOf(ev.target), pu = ev.target.closest && ev.target.closest('.wt-pusher');
        if (c) { ev.preventDefault(); setHome(c.e.city); } else if (pu) { ev.preventDefault(); press(pu.getAttribute('data-p')); }
      });
      host.addEventListener('focusin', function (ev) { var c = cityOf(ev.target); if (c) { var r = c.g.getBoundingClientRect(); showTip(c, r.left + r.width / 2, r.bottom - 14); } });
      host.addEventListener('focusout', hideTip);
    }
    function press(name) {
      if (name === 'crown') reset(); else if (name === 'zone') step(1);
      emit('pusher', name);
    }
    function cancelAnim() { st.lapse = null; st.resetting = false; host.classList.remove('lapsing'); }
    function reset() { st.lapse = null; host.classList.remove('lapsing'); var s = WT.skew() % 86400000; if (s > 43200000) s -= 86400000; if (s < -43200000) s += 86400000; WT.skew(s); st.resetting = true; }
    function timelapse() {
      if (st.lapse) { WT.skew(st.lapse.base); cancelAnim(); return; }
      st.resetting = false; st.lapse = { t0: performance.now(), base: WT.skew() }; host.classList.add('lapsing');
    }

    // ----- frame -----
    function frame(tp) {
      requestAnimationFrame(frame);
      if (!svg) return;
      var dt = Math.min(0.1, (tp - st.lastTp) / 1000 || 0.016); st.lastTp = tp;
      if (st.lapse) {
        var pr = (tp - st.lapse.t0) / 10000;
        if (pr >= 1) { WT.skew(st.lapse.base); cancelAnim(); }
        else WT.skew(st.lapse.base + (pr < 0.5 ? 4 * pr * pr * pr : 1 - Math.pow(-2 * pr + 2, 3) / 2) * 86400000);
      } else if (st.resetting) {
        var s = WT.skew() * Math.exp(-dt / 0.16);
        if (Math.abs(s) < 400) { s = 0; st.resetting = false; }
        WT.skew(s);
      }
      var ms = WT.now(); st.ms = ms;
      refreshZones(ms);
      // ease the earth frame toward the home zone (shortest way round)
      var offMin = WT.offsetMin(st.home.tz, ms), tgt = offMin / 60, k = 1 - Math.exp(-dt / 0.17);
      if (!(st.drag && st.drag.live)) {
        tgt += 24 * Math.round((st.off - tgt) / 24);
        st.off = Math.abs(tgt - st.off) < 0.0008 ? tgt : st.off + (tgt - st.off) * k;
        var mt = mod(offMin, 60), dm = mod(mt - st.mOff + 30, 60) - 30;
        st.mOff = Math.abs(dm) < 0.02 ? mt : mod(st.mOff + dm * k, 60);
      }
      var utcH = mod(ms, 86400000) / 3600000, loc = utcH + st.off;
      var secs = mod(ms, 60000) / 1000, sf = Math.floor(secs), fr = secs - sf;
      if (cfg.motion === 'hz4') secs = Math.floor(secs * 8) / 8;
      else if (cfg.motion === 'hz5') secs = Math.floor(secs * 10) / 10;
      else if (cfg.motion === 'tick') { var u = Math.min(1, fr / 0.11), eb = 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2); secs = sf - 1 + eb; }
      st.sA = secs * 6;
      st.mA = mod(mod(ms, 3600000) / 60000 + st.mOff, 60) * 6;
      st.hA = mod(loc, 12) * 30;
      st.ringA = mod(loc * 15, 360);
      st.earthA = mod(st.off * 15, 360);
      var R = function (a) { return 'rotate(' + f(a) + ')'; };
      G.earth.setAttribute('transform', R(st.earthA));
      G.map.setAttribute('transform', R(st.earthA));
      G.ring.setAttribute('transform', R(st.ringA));
      G.h[0].setAttribute('transform', R(st.hA)); G.h[1].setAttribute('transform', R(st.hA));
      G.m[0].setAttribute('transform', R(st.mA)); G.m[1].setAttribute('transform', R(st.mA));
      if (G.s) { G.s[0].setAttribute('transform', R(st.sA)); G.s[1].setAttribute('transform', R(st.sA)); }
      if (G.gf) {
        G.gf.earth.setAttribute('transform', R(st.earthA)); G.gf.ring.setAttribute('transform', R(st.ringA));
        G.gf.h.setAttribute('transform', R(st.hA)); G.gf.m.setAttribute('transform', R(st.mA)); G.gf.s.setAttribute('transform', R(st.sA));
      }
      // keep ring numerals and city names upright on screen
      var i, n, a, fl;
      for (i = 0; i < 24; i++) {
        n = numEls[i]; a = mod(st.ringA - n.h * 15, 360); fl = a > 90 && a < 270;
        if (fl !== n.flip) { n.flip = fl; n.el.setAttribute('transform', 'rotate(' + (-n.h * 15) + ') translate(0 -353)' + (fl ? ' rotate(180 0 0)' : '')); }
      }
      for (i = 0; i < cityEls.length; i++) {
        n = cityEls[i]; if (n.pip) continue;
        a = mod(st.earthA + n.A, 360); fl = a > 90 && a < 270;
        if (fl !== n.flip) { n.flip = fl; n.a.setAttribute('display', fl ? 'none' : null); n.b.setAttribute('display', fl ? null : 'none'); }
      }
      // sun: terminator on the map, sky colours on the ring
      var sun = WT.sun(ms), sk = Math.round(sun.lon * 4) + ':' + Math.round(sun.lat * 10);
      if (G.night && sk !== st.sunKey) { st.sunKey = sk; [0, 6, 12].forEach(function (dep, j) { G.night[j].setAttribute('d', nightPath(cfg.mapR, sun, dep)); }); }
      var yk = st.home.name + Math.round(sun.lat * 5) + cfg.ring;
      if (yk !== st.skyKey) { st.skyKey = yk; paintSky(sun, ms); }
      emit('frame', st, ms);
    }
    function paintSky(sun, ms) {
      // colour each quarter-hour of the ring by how high the sun stands at the home city at that clock time
      var lat = st.home.lat, lon = st.home.lon, l = WT.local(st.home.tz, ms);
      var ha = mod(lon - sun.lon + 180, 360) - 180, noon = l.hours - ha / 15, segs = G.sky.childNodes, lum = [];
      for (var i = 0; i < 96; i++) {
        var hr = (i + 0.5) / 4, c;
        if (cfg.ring === 'duo') { var dn = WT.clamp((Math.cos((hr - 12) * 15 * D2R) + 0.08) * 6 + 0.5, 0, 1); c = WT.ramp([[0, '#14161b'], [1, '#e9e6dc']], dn); }
        else {
          var H = (hr - noon) * 15 * D2R, s = Math.sin(lat * D2R) * Math.sin(sun.lat * D2R) + Math.cos(lat * D2R) * Math.cos(sun.lat * D2R) * Math.cos(H);
          c = WT.ramp(WT.SKY, Math.asin(WT.clamp(s, -1, 1)) / D2R);
        }
        segs[i].setAttribute('fill', c.css); lum[i] = c.lum;
      }
      numEls.forEach(function (n) { n.el.setAttribute('fill', lum[mod(n.h * 4, 96)] + lum[mod(n.h * 4 - 1, 96)] > 1.15 ? '#141a24' : '#ffffff'); });
    }

    build();
    requestAnimationFrame(frame);

    return {
      host: host, cfg: cfg, st: st, get svg() { return svg; }, get G() { return G; }, get glowItems() { return glowItems; }, get zones() { return zones; },
      on: function (n, fn) { (listeners[n] = listeners[n] || []).push(fn); return this; },
      set: function (o) { for (var k in o) cfg[k] = o[k]; build(); return this; },
      setHome: setHome, step: step, reset: reset, timelapse: timelapse, cancelAnim: cancelAnim, press: press,
      local: function () { setHome(WT.cityFor(localTz)); },
      framePos: function (it) {          // where a lume element currently sits, in viewBox units
        var a = it.a + (it.frame === 'earth' ? st.earthA : it.frame === 'ring' ? st.ringA : it.frame === 'h' ? st.hA : it.frame === 'm' ? st.mA : it.frame === 's' ? st.sA : 0);
        return pol(it.r, a);
      },
      E: E, pol: pol, wedge: wedge
    };
  };
})();
