/* World Timer — shared page behaviour for the watch pages: digital readout, chips, city search, keyboard, URL state. */
(function () {
  'use strict';
  var WT = window.WT;

  WT.hash = {
    get: function () { var o = {}; new URLSearchParams(location.hash.slice(1)).forEach(function (v, k) { o[k] = v; }); return o; },
    set: function (patch) {
      var p = new URLSearchParams(location.hash.slice(1));
      Object.keys(patch).forEach(function (k) { if (patch[k] == null || patch[k] === '') p.delete(k); else p.set(k, patch[k]); });
      var s = p.toString();
      try { history.replaceState(null, '', s ? '#' + s : location.pathname + location.search); } catch (e) { }
    }
  };
  WT.homeFromHash = function () {
    var h = WT.hash.get().home; if (!h) return null;
    var c = WT.CITIES.filter(function (c) { return c.name.toLowerCase() === h.toLowerCase(); })[0];
    return c || null;
  };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  WT.el = el;
  WT.chip = function (parent, label, fn, title) {
    var b = el('button', 'chip', label); b.type = 'button'; if (title) b.title = title;
    b.addEventListener('click', function () { fn(b); b.blur(); }); parent.appendChild(b); return b;
  };

  WT.page = function (w, o) {
    o = o || {};
    var $ = function (id) { return document.getElementById(id); };
    var time = $('time'), date = $('date'), zone = $('zone'), chips = $('chips'), localTz = WT.localTz(), last = -1;
    var bNow = WT.chip(chips, 'Now', function () { w.reset(); }, 'Return to the current time (N)');
    var bLocal = WT.chip(chips, 'My zone', function () { w.local(); }, 'Return to your own time zone (L)');
    WT.chip(chips, 'Find city', function () { openSearch(''); }, 'Search cities (/)');
    if (o.lapse !== false) WT.chip(chips, '24h lapse', function () { w.timelapse(); }, 'Run a full day in ten seconds (T)');
    bNow.hidden = bLocal.hidden = true;

    function skewText(ms) {
      var a = Math.abs(ms), d = Math.floor(a / 86400000), h = Math.floor(a % 86400000 / 3600000), m = Math.round(a % 3600000 / 60000);
      if (m === 60) { m = 0; h++; }
      return (ms > 0 ? '+' : '−') + (d ? d + 'd ' : '') + (h ? h + 'h ' : '') + m + 'm';
    }
    w.on('frame', function (st, ms) {
      var sec = Math.floor(ms / 1000); if (sec === last) return; last = sec;
      var l = WT.local(st.home.tz, ms), sk = WT.skew();
      if (time && !o.ownTime) time.textContent = WT.fmtTime(l, true);
      if (date) date.textContent = WT.fmtDate(l.d);
      if (zone) {
        zone.textContent = '';
        zone.appendChild(el('b', '', st.home.name));
        zone.appendChild(document.createTextNode(' · ' + WT.fmtOffset(l.off) + (Math.abs(sk) > 30000 ? ' · ' + skewText(sk) + ' from now' : '')));
      }
      bNow.hidden = Math.abs(sk) < 1000;
      bLocal.hidden = st.home.tz === localTz;
      w.svg.setAttribute('aria-label', 'World timer showing ' + WT.fmtTime(l) + ' in ' + st.home.name);
    });
    w.on('home', function (c) { last = -1; WT.hash.set({ home: c.guessed || c.tz === localTz && c.name === WT.cityFor(localTz).name ? null : c.name }); });

    // ----- search -----
    var ov = el('div', 'search'), box = el('div', 'box'), inp = el('input'), ul = el('ul'), results = [], sel = 0;
    inp.type = 'text'; inp.placeholder = 'Find a city…'; inp.setAttribute('aria-label', 'Find a city'); inp.autocomplete = 'off'; inp.spellcheck = false;
    ul.setAttribute('role', 'listbox');
    box.appendChild(inp); box.appendChild(ul); ov.appendChild(box); document.body.appendChild(ov);
    function render() {
      var q = inp.value, ms = WT.now();
      results = (q.trim() ? WT.findCity(q) : WT.CITIES.slice(0, 26)).slice(0, 40);
      sel = Math.min(sel, Math.max(0, results.length - 1));
      ul.textContent = '';
      results.forEach(function (c, i) {
        var li = el('li', '', c.name), l = WT.local(c.tz, ms);
        li.setAttribute('role', 'option'); li.setAttribute('aria-selected', i === sel);
        li.appendChild(el('span', '', WT.fmtTime(l) + '  ' + WT.fmtOffset(l.off)));
        li.addEventListener('click', function () { pick(c); });
        ul.appendChild(li);
      });
      if (!results.length) ul.appendChild(el('li', '', 'No match'));
      var s = ul.children[sel]; if (s && s.scrollIntoView) s.scrollIntoView({ block: 'nearest' });
    }
    function openSearch(seed) { ov.classList.add('on'); inp.value = seed || ''; sel = 0; render(); inp.focus(); }
    function closeSearch() { ov.classList.remove('on'); inp.blur(); }
    function pick(c) { closeSearch(); if (c) w.setHome(c); }
    inp.addEventListener('input', function () { sel = 0; render(); });
    inp.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { sel = Math.min(results.length - 1, sel + 1); render(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { sel = Math.max(0, sel - 1); render(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { pick(results[sel]); ev.preventDefault(); }
      else if (ev.key === 'Escape') { closeSearch(); }
      ev.stopPropagation();
    });
    ov.addEventListener('pointerdown', function (ev) { if (ev.target === ov) closeSearch(); });

    // ----- keyboard -----
    document.addEventListener('keydown', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      var k = ev.key;
      if (o.keys && o.keys(ev) === true) return;
      if (k === '/') { openSearch(''); ev.preventDefault(); }
      else if (k === 'ArrowRight') { w.step(1); ev.preventDefault(); }
      else if (k === 'ArrowLeft') { w.step(-1); ev.preventDefault(); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { w.cancelAnim(); WT.skew(WT.skew() + (k === 'ArrowUp' ? 1 : -1) * (ev.shiftKey ? 86400000 : 3600000)); ev.preventDefault(); }
      else if (k === 'n' || k === 'N' || k === 'Escape') w.reset();
      else if (k === 'l' || k === 'L') w.local();
      else if ((k === 't' || k === 'T') && o.lapse !== false) w.timelapse();
      else if (k.length === 1 && /[a-z]/i.test(k) && !o.noType) { openSearch(k); ev.preventDefault(); }
    });
    return { openSearch: openSearch, chips: chips };
  };
})();
