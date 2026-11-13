/* World Timer — shared core: virtual clock, time-zone math, solar position, city data, page nav.
   Plain script (no modules) so every page also works when opened straight from file://. */
(function () {
  'use strict';
  var WT = window.WT = {};
  var D2R = Math.PI / 180;
  WT.D2R = D2R;

  // ---------- virtual clock: real time plus a skew, so pages can scrub / time-lapse ----------
  var skew = 0;
  WT.now = function () { return Date.now() + skew; };
  WT.skew = function (v) { if (v !== undefined) skew = v; return skew; };

  // ---------- time zones ----------
  var fmt = {}, offCache = {};
  function partsOf(tz, ms) {
    var f = fmt[tz] || (fmt[tz] = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    }));
    var o = {};
    f.formatToParts(ms).forEach(function (p) { if (p.type !== 'literal') o[p.type] = +p.value; });
    return o;
  }
  /** Minutes east of UTC for an IANA zone at an instant (cached per 15-minute bucket). */
  WT.offsetMin = function (tz, ms) {
    var bucket = Math.floor(ms / 900000), c = offCache[tz];
    if (c && c.b === bucket) return c.v;
    var v = 0;
    try {
      var t = bucket * 900000, p = partsOf(tz, t);
      v = Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t) / 60000);
    } catch (e) { v = 0; }
    offCache[tz] = { b: bucket, v: v };
    return v;
  };
  /** Wall-clock fields for a zone. `d` is a Date whose UTC getters read as local time there. */
  WT.local = function (tz, ms) {
    var off = WT.offsetMin(tz, ms), d = new Date(ms + off * 60000);
    return {
      d: d, off: off, h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds(),
      hours: d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3600000
    };
  };
  WT.localTz = function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; } };
  WT.pad = function (n) { return (n < 10 ? '0' : '') + n; };
  WT.fmtOffset = function (min) {
    var a = Math.abs(min);
    return 'UTC' + (min < 0 ? '−' : '+') + WT.pad(Math.floor(a / 60)) + ':' + WT.pad(a % 60);
  };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  WT.fmtDate = function (d, short) {
    return short
      ? DAYS[d.getUTCDay()].slice(0, 3) + ' ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3)
      : DAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  };
  WT.fmtTime = function (l, secs) { return WT.pad(l.h) + ':' + WT.pad(l.m) + (secs ? ':' + WT.pad(l.s) : ''); };

  // ---------- sun ----------
  /** Subsolar point (degrees) at an instant. Low-precision almanac formulae, good to ~0.01 deg. */
  WT.sun = function (ms) {
    var d = ms / 86400000 - 10957.5;                       // days since J2000.0
    var g = (357.529 + 0.98560028 * d) * D2R;
    var L = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * D2R;
    var e = (23.439 - 0.00000036 * d) * D2R;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / D2R;
    var dec = Math.asin(Math.sin(e) * Math.sin(L)) / D2R;
    var gmst = (18.697374558 + 24.06570982441908 * d) * 15;
    var lon = ((ra - gmst) % 360 + 540) % 360 - 180;
    return { lat: dec, lon: lon };
  };
  /** Solar elevation in degrees at a place. */
  WT.elevation = function (sun, lat, lon) {
    var s = Math.sin(lat * D2R) * Math.sin(sun.lat * D2R) + Math.cos(lat * D2R) * Math.cos(sun.lat * D2R) * Math.cos((lon - sun.lon) * D2R);
    return Math.asin(Math.max(-1, Math.min(1, s))) / D2R;
  };
  /** Unit vector for a lat/lon; y is the north pole, +x is lon 0, +z is lon 90W (right-handed). */
  WT.vec = function (lat, lon) {
    var c = Math.cos(lat * D2R);
    return [c * Math.cos(lon * D2R), Math.sin(lat * D2R), -c * Math.sin(lon * D2R)];
  };
  /** Rough moon phase 0..1 (0 = new, 0.5 = full). */
  WT.moonPhase = function (ms) {
    var p = ((ms / 86400000 - 10962.76) / 29.530588853) % 1;
    return p < 0 ? p + 1 : p;
  };

  // ---------- cities: [name, zone, lat, lon]; order is priority when several share an offset ----------
  WT.CITIES = [
    ['London', 'Europe/London', 51.51, -0.13], ['Paris', 'Europe/Paris', 48.86, 2.35], ['Geneva', 'Europe/Zurich', 46.20, 6.14],
    ['Cairo', 'Africa/Cairo', 30.04, 31.24], ['Moscow', 'Europe/Moscow', 55.76, 37.62], ['Dubai', 'Asia/Dubai', 25.20, 55.27],
    ['Karachi', 'Asia/Karachi', 24.86, 67.01], ['Dhaka', 'Asia/Dhaka', 23.81, 90.41], ['Bangkok', 'Asia/Bangkok', 13.76, 100.50],
    ['Singapore', 'Asia/Singapore', 1.35, 103.82], ['Hong Kong', 'Asia/Hong_Kong', 22.32, 114.17], ['Tokyo', 'Asia/Tokyo', 35.68, 139.69],
    ['Sydney', 'Australia/Sydney', -33.87, 151.21], ['Auckland', 'Pacific/Auckland', -36.85, 174.76], ['Nouméa', 'Pacific/Noumea', -22.27, 166.44],
    ['Honolulu', 'Pacific/Honolulu', 21.31, -157.86], ['Anchorage', 'America/Anchorage', 61.22, -149.90],
    ['Los Angeles', 'America/Los_Angeles', 34.05, -118.24], ['Denver', 'America/Denver', 39.74, -104.99], ['Chicago', 'America/Chicago', 41.88, -87.63],
    ['New York', 'America/New_York', 40.71, -74.01], ['Caracas', 'America/Caracas', 10.48, -66.90], ['Rio', 'America/Sao_Paulo', -22.91, -43.17],
    ['Noronha', 'America/Noronha', -3.85, -32.42], ['Azores', 'Atlantic/Azores', 37.74, -25.68], ['Midway', 'Pacific/Midway', 28.20, -177.37],
    ['San Francisco', 'America/Los_Angeles', 37.77, -122.42], ['Vancouver', 'America/Vancouver', 49.28, -123.12], ['Tijuana', 'America/Tijuana', 32.51, -117.04],
    ['Phoenix', 'America/Phoenix', 33.45, -112.07], ['Calgary', 'America/Edmonton', 51.05, -114.07], ['Houston', 'America/Chicago', 29.76, -95.37],
    ['Mexico City', 'America/Mexico_City', 19.43, -99.13], ['Guatemala', 'America/Guatemala', 14.63, -90.51], ['Miami', 'America/New_York', 25.76, -80.19],
    ['Toronto', 'America/Toronto', 43.65, -79.38], ['Bogotá', 'America/Bogota', 4.71, -74.07], ['Lima', 'America/Lima', -12.05, -77.04],
    ['Halifax', 'America/Halifax', 44.65, -63.57], ['La Paz', 'America/La_Paz', -16.50, -68.15], ['Santiago', 'America/Santiago', -33.45, -70.67],
    ['São Paulo', 'America/Sao_Paulo', -23.55, -46.63], ['Buenos Aires', 'America/Argentina/Buenos_Aires', -34.60, -58.38],
    ['S. Georgia', 'Atlantic/South_Georgia', -54.28, -36.51], ['Cape Verde', 'Atlantic/Cape_Verde', 14.93, -23.51],
    ['Dublin', 'Europe/Dublin', 53.35, -6.26], ['Lisbon', 'Europe/Lisbon', 38.72, -9.14], ['Reykjavik', 'Atlantic/Reykjavik', 64.15, -21.94], ['Accra', 'Africa/Accra', 5.60, -0.19],
    ['Berlin', 'Europe/Berlin', 52.52, 13.40], ['Madrid', 'Europe/Madrid', 40.42, -3.70], ['Rome', 'Europe/Rome', 41.90, 12.50], ['Lagos', 'Africa/Lagos', 6.52, 3.38],
    ['Athens', 'Europe/Athens', 37.98, 23.73], ['Johannesburg', 'Africa/Johannesburg', -26.20, 28.05], ['Helsinki', 'Europe/Helsinki', 60.17, 24.94],
    ['Istanbul', 'Europe/Istanbul', 41.01, 28.98], ['Nairobi', 'Africa/Nairobi', -1.29, 36.82], ['Riyadh', 'Asia/Riyadh', 24.71, 46.68],
    ['Baku', 'Asia/Baku', 40.41, 49.87], ['Tashkent', 'Asia/Tashkent', 41.30, 69.24], ['Bishkek', 'Asia/Bishkek', 42.87, 74.59],
    ['Jakarta', 'Asia/Jakarta', -6.21, 106.85], ['Hanoi', 'Asia/Ho_Chi_Minh', 21.03, 105.85], ['Shanghai', 'Asia/Shanghai', 31.23, 121.47],
    ['Beijing', 'Asia/Shanghai', 39.90, 116.41], ['Perth', 'Australia/Perth', -31.95, 115.86], ['Seoul', 'Asia/Seoul', 37.57, 126.98],
    ['Melbourne', 'Australia/Melbourne', -37.81, 144.96], ['Brisbane', 'Australia/Brisbane', -27.47, 153.03], ['Guam', 'Pacific/Guam', 13.44, 144.79],
    ['Solomon Is', 'Pacific/Guadalcanal', -9.43, 159.95], ['Fiji', 'Pacific/Fiji', -18.14, 178.44], ['Samoa', 'Pacific/Apia', -13.83, -171.77],
    ['Tonga', 'Pacific/Tongatapu', -21.14, -175.20], ['Kiritimati', 'Pacific/Kiritimati', 1.87, -157.43], ['Tahiti', 'Pacific/Tahiti', -17.53, -149.57],
    ['Pago Pago', 'Pacific/Pago_Pago', -14.28, -170.70], ['Gambier', 'Pacific/Gambier', -23.12, -134.97],
    // zones off the whole hour: shown as pips between the ring cities
    ['Delhi', 'Asia/Kolkata', 28.61, 77.21], ['Mumbai', 'Asia/Kolkata', 19.08, 72.88], ['Colombo', 'Asia/Colombo', 6.93, 79.86],
    ['Kathmandu', 'Asia/Kathmandu', 27.72, 85.32], ['Tehran', 'Asia/Tehran', 35.69, 51.39], ['Kabul', 'Asia/Kabul', 34.53, 69.17],
    ['Yangon', 'Asia/Yangon', 16.87, 96.20], ['Adelaide', 'Australia/Adelaide', -34.93, 138.60], ['Darwin', 'Australia/Darwin', -12.46, 130.84],
    ["St. John's", 'America/St_Johns', 47.56, -52.71], ['Marquesas', 'Pacific/Marquesas', -9.78, -139.03], ['Chatham Is', 'Pacific/Chatham', -43.95, -176.56]
  ].map(function (c) { return { name: c[0], tz: c[1], lat: c[2], lon: c[3] }; });

  /** Put an offset in hours onto the 24-slot ring: (-12, 12]. */
  WT.wrapOff = function (h) { h = ((h + 12) % 24 + 24) % 24 - 12; return h <= -12 + 1e-9 ? h + 24 : h; };

  /** One headline city per whole-hour slot, plus the off-hour cities, for an instant (so DST is honoured). */
  WT.zones = function (ms) {
    var slots = {}, all = {}, frac = [];
    WT.CITIES.forEach(function (c) {
      var off = WT.offsetMin(c.tz, ms), w = WT.wrapOff(off / 60);
      var e = { city: c, off: off, slot: w };
      if (off % 60 === 0) {
        if (!slots[w]) slots[w] = e;
        (all[w] = all[w] || []).push(c);
      } else if (!frac.some(function (f) { return f.slot === w; })) frac.push(e);
      else frac.filter(function (f) { return f.slot === w; })[0].also = (frac.filter(function (f) { return f.slot === w; })[0].also || []).concat(c);
    });
    var ring = Object.keys(slots).map(function (k) { return slots[k]; }).sort(function (a, b) { return a.slot - b.slot; });
    ring.forEach(function (e) { e.also = all[e.slot].filter(function (c) { return c !== e.city; }); });
    return { ring: ring, frac: frac };
  };

  /** Best city record for a zone id (falls back to a mid-latitude point on the zone's meridian). */
  var TZ_ALIAS = { 'Asia/Calcutta': 'Asia/Kolkata', 'Asia/Saigon': 'Asia/Ho_Chi_Minh', 'Asia/Katmandu': 'Asia/Kathmandu', 'Asia/Rangoon': 'Asia/Yangon',
    'America/Buenos_Aires': 'America/Argentina/Buenos_Aires', 'Europe/Kiev': 'Europe/Kyiv', 'Pacific/Samoa': 'Pacific/Pago_Pago', 'Asia/Dacca': 'Asia/Dhaka' };
  WT.cityFor = function (tz, ms) {
    tz = TZ_ALIAS[tz] || tz;
    for (var i = 0; i < WT.CITIES.length; i++) if (WT.CITIES[i].tz === tz) return WT.CITIES[i];
    var off = WT.offsetMin(tz, ms || Date.now());
    var south = /^(Australia|Antarctica)|Auckland|Sao_Paulo|Buenos|Santiago|Johannesburg|Maputo|Windhoek|Lima|La_Paz/.test(tz);
    return { name: tz.split('/').pop().replace(/_/g, ' '), tz: tz, lat: south ? -33 : 40, lon: off / 4, guessed: true };
  };
  WT.findCity = function (q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    q = norm(q);
    var a = [], b = [];
    WT.CITIES.forEach(function (c) { var n = norm(c.name); if (n.indexOf(q) === 0) a.push(c); else if (n.indexOf(q) > 0 || c.tz.toLowerCase().indexOf(q.replace(/ /g, '_')) >= 0) b.push(c); });
    return a.concat(b);
  };

  // ---------- small helpers ----------
  WT.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  WT.lerp = function (a, b, t) { return a + (b - a) * t; };
  WT.hex = function (h) { h = h.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  WT.mix = function (a, b, t) { a = WT.hex(a); b = WT.hex(b); return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * t) + ',' + Math.round(a[1] + (b[1] - a[1]) * t) + ',' + Math.round(a[2] + (b[2] - a[2]) * t) + ')'; };
  /** Piecewise-linear colour ramp: stops = [[x, '#hex'], ...] sorted by x. Returns {css, lum}. */
  WT.ramp = function (stops, x) {
    var i = 0; while (i < stops.length - 2 && x > stops[i + 1][0]) i++;
    var a = stops[i], b = stops[i + 1], t = WT.clamp((x - a[0]) / (b[0] - a[0]), 0, 1), A = WT.hex(a[1]), B = WT.hex(b[1]);
    var r = A[0] + (B[0] - A[0]) * t, g = A[1] + (B[1] - A[1]) * t, bl = A[2] + (B[2] - A[2]) * t;
    return { css: 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(bl) + ')', lum: (0.299 * r + 0.587 * g + 0.114 * bl) / 255 };
  };
  WT.SKY = [[-18, '#0a1429'], [-12, '#101c3a'], [-6, '#2a2f5c'], [-2.5, '#74487a'], [-0.5, '#d9744a'], [1.5, '#f0a35e'], [5, '#f6d7a0'], [11, '#a9d6f0'], [30, '#bfe3f6'], [60, '#d6eefb']];

  // ---------- page chrome: variant navigation ----------
  WT.VARIANTS = [
    ['index.html', 'Heritage', 'The refined classic'],
    ['chrono.html', 'Chrono', 'Split-seconds chronograph'],
    ['atelier.html', 'Atelier', 'Build your own dial'],
    ['nocturne.html', 'Nocturne', 'Lume, torch and repeater'],
    ['globe.html', 'Globe', 'WebGL Earth, VR and AR'],
    ['planisphere.html', 'Planisphere', 'Flat map and meeting planner'],
    ['worldtimer.html', 'Original', 'The first version']
  ];
  WT.nav = function (current) {
    var nav = document.createElement('nav');
    nav.className = 'wt-nav'; nav.setAttribute('aria-label', 'World Timer variants');
    WT.VARIANTS.forEach(function (v) {
      var a = document.createElement('a');
      a.href = v[0]; a.textContent = v[1]; a.title = v[2];
      if (v[0] === current) a.setAttribute('aria-current', 'page');
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    return nav;
  };
})();
