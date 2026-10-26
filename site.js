// fauve.nyc: the app's flows on a large screen. Listings come from site/data.js, generated from the app's
// bundled events and places (scripts/make-site-data.mjs). No libraries.
(() => {
  'use strict';
  const D = window.FAUVE_DATA || { events: [], places: [], generated: '' };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const APP = 'https://apps.apple.com/app/id6825388764';

  const SCENES = ['house', 'jazz', 'wine', 'art'];
  const COLOR = { house: '#D4FF00', jazz: '#3D7BFF', wine: '#FF6A1A', art: '#FF3EA5' };
  const CHIP = { all: 'ALL', house: 'HOUSE/TECHNO', jazz: 'JAZZ', wine: 'NATTY', art: 'ART' };
  const GLYPH = { house: 'H', jazz: 'J', wine: 'N', art: 'A' };
  const setAccent = (scene) => document.documentElement.style.setProperty('--accent', COLOR[scene] || COLOR.house);

  // ---------- Nights, New York time. A night runs until 5am, as in the app. ----------
  const NY = 'America/New_York';
  const keyFmt = new Intl.DateTimeFormat('en-CA', { timeZone: NY, year: 'numeric', month: '2-digit', day: '2-digit' });
  const nightKey = (t) => keyFmt.format(new Date(t - 5 * 3600e3));
  const keyDate = (k) => new Date(`${k}T12:00:00Z`);
  const fmtShort = (k) => {
    const d = keyDate(k);
    return { wd: d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase(), day: d.getUTCDate(), mon: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase() };
  };
  const label = (k) => { const f = fmtShort(k); return `${f.wd} ${f.day} ${f.mon}`; };
  const tonight = nightKey(Date.now());
  const addDays = (k, n) => { const d = keyDate(k); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const onNight = (e, k) => nightKey(Date.parse(e.startsAt)) <= k && nightKey(Date.parse(e.endsAt) - 60e3) >= k;
  const eventsOn = (k) => D.events.filter((e) => onNight(e, k));
  // Runs, residencies and exhibitions after the night's one-off events (src/data/filter.ts).
  const runRank = (e, k) => (nightKey(Date.parse(e.startsAt)) < k || nightKey(Date.parse(e.endsAt) - 60e3) > nightKey(Date.parse(e.startsAt)) ? 1 : 0);
  const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: NY });

  // ---------- Geography ----------
  const LNG0 = -74.06, LAT0 = 40.83, K = 12000, KX = K * Math.cos((40.72 * Math.PI) / 180);
  const proj = (lat, lng) => ({ x: (lng - LNG0) * KX, y: (LAT0 - lat) * K });
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // Stylized water: the Hudson, the East River, Newtown Creek and the Upper Bay. Not a survey map.
  const WATER = [
    { w: 70, pts: [[40.83, -73.952], [40.81, -73.965], [40.79, -73.982], [40.77, -73.998], [40.75, -74.012], [40.73, -74.017], [40.71, -74.021], [40.69, -74.03]] },
    { w: 46, pts: [[40.80, -73.93], [40.785, -73.937], [40.77, -73.946], [40.757, -73.957], [40.745, -73.966], [40.732, -73.971], [40.718, -73.974], [40.708, -73.983], [40.703, -73.996], [40.699, -74.01], [40.69, -74.025]] },
    { w: 16, pts: [[40.738, -73.962], [40.735, -73.947], [40.728, -73.935], [40.72, -73.926], [40.714, -73.92]] },
  ];
  const BAY = [[40.705, -74.06], [40.69, -74.03], [40.68, -74.02], [40.665, -74.02], [40.645, -74.03], [40.62, -74.045], [40.57, -74.06]];
  const DISTRICTS = [
    ['GREENPOINT', 40.7305, -73.952], ['WILLIAMSBURG', 40.711, -73.958], ['BUSHWICK', 40.697, -73.918], ['RIDGEWOOD', 40.707, -73.902],
    ['BED-STUY', 40.686, -73.941], ['CROWN HEIGHTS', 40.669, -73.944], ['FORT GREENE', 40.69, -73.976], ['GOWANUS', 40.674, -73.992],
    ['RED HOOK', 40.676, -74.012], ['LOWER EAST SIDE', 40.716, -73.987], ['EAST VILLAGE', 40.727, -73.983], ['WEST VILLAGE', 40.735, -74.004],
    ['CHELSEA', 40.747, -74.001], ['TRIBECA', 40.718, -74.009], ['MIDTOWN', 40.757, -73.985], ['LONG ISLAND CITY', 40.745, -73.947],
  ];

  // ---------- Map: one renderer for Explore and Plan ----------
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
  class FauveMap {
    constructor(host, { interactive = true } = {}) {
      this.host = host; this.s = 0.42; this.c = proj(40.712, -73.962); this.items = new Map();
      this.svg = svgEl('svg', { 'aria-hidden': 'true' });
      this.world = svgEl('g', { class: 'world' });
      this.svg.appendChild(this.world);
      host.appendChild(this.svg);
      this.drawGround();
      this.routeLayer = svgEl('g'); this.pinLayer = svgEl('g');
      this.world.append(this.routeLayer, this.pinLayer);
      this.tip = document.createElement('div'); this.tip.className = 'map-tip'; host.appendChild(this.tip);
      new ResizeObserver(() => this.apply(true)).observe(host);
      if (interactive) this.bindDrag();
      this.apply(true);
    }
    drawGround() {
      const g = svgEl('g');
      const a = proj(40.86, -74.1), b = proj(40.54, -73.82);
      for (let x = Math.floor(a.x / 120) * 120; x < b.x; x += 120) g.appendChild(svgEl('line', { x1: x, y1: a.y, x2: x, y2: b.y, stroke: '#1E1E1C', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }));
      for (let y = Math.floor(a.y / 120) * 120; y < b.y; y += 120) g.appendChild(svgEl('line', { x1: a.x, y1: y, x2: b.x, y2: y, stroke: '#1E1E1C', 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke' }));
      const bay = BAY.map(([la, ln]) => proj(la, ln)).map((p) => `${p.x},${p.y}`);
      g.appendChild(svgEl('polygon', { points: [...bay, `${a.x},${b.y}`, `${a.x},${proj(40.705, -74.1).y}`].join(' '), fill: '#050505' }));
      for (const r of WATER) {
        const d = r.pts.map(([la, ln], i) => { const p = proj(la, ln); return `${i ? 'L' : 'M'}${p.x},${p.y}`; }).join('');
        g.appendChild(svgEl('path', { d, fill: 'none', stroke: '#050505', 'stroke-width': r.w, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      }
      const t = svgEl('g', { class: 'districts' });
      for (const [n, la, ln] of DISTRICTS) { const p = proj(la, ln); const tx = svgEl('text', { x: p.x, y: p.y, 'text-anchor': 'middle' }); tx.textContent = n; t.appendChild(tx); }
      g.appendChild(t);
      this.world.appendChild(g);
    }
    size() { return { w: this.host.clientWidth || 1, h: this.host.clientHeight || 1 }; }
    apply(instant) {
      const { w, h } = this.size();
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      if (instant) this.host.classList.add('instant');
      this.world.style.transform = `translate(${w / 2 - this.c.x * this.s}px, ${h / 2 - this.c.y * this.s}px) scale(${this.s})`;
      this.world.style.setProperty('--inv', 1 / this.s);
      for (const it of this.items.values()) it.inner.setAttribute('transform', `scale(${1 / this.s})`);
      if (instant) requestAnimationFrame(() => this.host.classList.remove('instant'));
      if (this.tipKey) this.placeTip(this.tipKey);
    }
    focus(lat, lng, s) { this.c = proj(lat, lng); if (s) this.s = s; this.apply(reduce); }
    zoom(f) { this.s = Math.min(3.2, Math.max(0.18, this.s * f)); this.apply(reduce); }
    fit(points, pad = 0.78, max = 2.2) {
      if (!points.length) return;
      const ps = points.map((p) => proj(p.lat, p.lng));
      const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const { w, h } = this.size();
      this.c = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
      this.s = Math.min(max, Math.max(0.18, Math.min((w * pad) / Math.max(60, maxX - minX), (h * pad) / Math.max(60, maxY - minY))));
      this.apply(reduce);
    }
    setPins(list, { onEnter, onLeave, onClick } = {}) {
      this.pinLayer.replaceChildren(); this.items.clear(); this.hideTip();
      list.forEach((it, i) => {
        const p = proj(it.lat, it.lng);
        const g = svgEl('g', { class: 'pin' + (reduce ? '' : ' pop'), transform: `translate(${p.x},${p.y})`, tabindex: '-1' });
        g.style.animationDelay = `${Math.min(i * 6, 500)}ms`;
        const inner = svgEl('g', { transform: `scale(${1 / this.s})` });
        inner.append(svgEl('rect', { x: -13, y: -13, width: 26, height: 26, fill: COLOR[it.scene] }), Object.assign(svgEl('text', { x: 0, y: 5, 'text-anchor': 'middle' }), { textContent: it.glyph || GLYPH[it.scene] }));
        g.appendChild(inner);
        g.addEventListener('pointerenter', () => { this.showTip(it.key); onEnter && onEnter(it); });
        g.addEventListener('pointerleave', () => { this.hideTip(); onLeave && onLeave(it); });
        g.addEventListener('click', (ev) => { ev.stopPropagation(); onClick && onClick(it); });
        this.pinLayer.appendChild(g);
        this.items.set(it.key, { it, g, inner, p });
      });
    }
    mark(key, cls, on) { const x = this.items.get(key); if (x) x.g.classList.toggle(cls, on); }
    select(key) { for (const [k, x] of this.items) x.g.classList.toggle('sel', k === key); const x = this.items.get(key); if (x) this.pinLayer.appendChild(x.g); }
    showTip(key) {
      const x = this.items.get(key); if (!x) return;
      this.tipKey = key;
      this.tip.style.setProperty('--c', COLOR[x.it.scene]);
      this.tip.innerHTML = `<span>${esc(x.it.kicker)}</span><b>${esc(x.it.name)}</b><small>${esc(x.it.sub)}</small>`;
      this.placeTip(key); this.tip.classList.add('on');
    }
    placeTip(key) {
      const x = this.items.get(key); if (!x) return;
      const { w, h } = this.size();
      this.tip.style.left = `${w / 2 + (x.p.x - this.c.x) * this.s}px`;
      this.tip.style.top = `${h / 2 + (x.p.y - this.c.y) * this.s}px`;
    }
    hideTip() { this.tipKey = null; this.tip.classList.remove('on'); }
    bindDrag() {
      let start = null;
      this.host.addEventListener('pointerdown', (e) => { if (e.button) return; start = { x: e.clientX, y: e.clientY, c: { ...this.c }, moved: false }; this.host.setPointerCapture(e.pointerId); });
      this.host.addEventListener('pointermove', (e) => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!start.moved && Math.hypot(dx, dy) < 4) return;
        start.moved = true; this.host.classList.add('dragging'); this.hideTip();
        this.c = { x: start.c.x - dx / this.s, y: start.c.y - dy / this.s }; this.apply(false);
      });
      const end = () => { start = null; this.host.classList.remove('dragging'); };
      this.host.addEventListener('pointerup', end); this.host.addEventListener('pointercancel', end);
      this.host.addEventListener('wheel', (e) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); this.zoom(e.deltaY < 0 ? 1.12 : 0.89); }, { passive: false });
    }
    route(stops, from) {
      this.routeLayer.replaceChildren();
      const pts = [from, ...stops].map((s) => proj(s.lat, s.lng));
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('');
      const solid = svgEl('path', { d, class: 'route-solid', 'vector-effect': 'non-scaling-stroke' });
      const dash = svgEl('path', { d, class: 'route-line draw', 'vector-effect': 'non-scaling-stroke' });
      this.routeLayer.append(solid, dash);
      const start = svgEl('g', { transform: `translate(${pts[0].x},${pts[0].y})` });
      const si = svgEl('g', { transform: `scale(${1 / this.s})` });
      si.append(svgEl('rect', { x: -9, y: -9, width: 18, height: 18, fill: '#0A0A0A', stroke: '#F2F2EE', 'stroke-width': 3 }));
      start.appendChild(si); this.routeLayer.appendChild(start);
      this.items.set('__start', { it: { scene: 'house' }, g: start, inner: si, p: pts[0] });
      stops.forEach((s, i) => {
        const p = pts[i + 1];
        const g = svgEl('g', { class: 'stop-num', transform: `translate(${p.x},${p.y})` });
        const inner = svgEl('g', { transform: `scale(${1 / this.s})` });
        inner.append(svgEl('rect', { x: -16, y: -16, width: 32, height: 32, fill: COLOR[s.scene] }), Object.assign(svgEl('text', { x: 0, y: 6, 'text-anchor': 'middle' }), { textContent: i + 1 }));
        g.appendChild(inner); this.routeLayer.appendChild(g);
        this.items.set('__stop' + i, { it: s, g, inner, p });
      });
      // Draw the line from the first stop to the last.
      requestAnimationFrame(() => {
        const len = solid.getTotalLength() * this.s;
        solid.style.strokeDasharray = `${len}`; solid.style.strokeDashoffset = reduce ? '0' : `${len}`;
        solid.getBoundingClientRect();
        solid.style.transition = reduce ? 'none' : 'stroke-dashoffset 1.6s cubic-bezier(.7,0,.2,1) .3s';
        solid.style.strokeDashoffset = '0';
      });
    }
  }

  // ---------- Listings as map items and cards ----------
  const evItem = (e) => ({ key: 'e:' + e.id, kind: 'event', scene: e.scene, lat: e.lat, lng: e.lng, name: e.title, venue: e.venue, kicker: `${e.tag} · ${e.time}`, sub: `${e.venue} · ${e.area}`, e });
  const plItem = (p) => ({ key: 'p:' + p.id, kind: 'place', scene: p.scene, lat: p.lat, lng: p.lng, name: p.name, venue: p.name, kicker: `${p.kind} · ${p.area}`, sub: p.address, p });

  function cardHTML(it, i) {
    const delay = `style="animation-delay:${Math.min(i * 45, 600)}ms"`;
    if (it.kind === 'event') {
      const e = it.e; const when = onNight(e, tonight) ? 'TONIGHT' : label(nightKey(Date.parse(e.startsAt)));
      return `<article class="card ${e.scene}" data-key="${it.key}" ${delay}>
        <button class="toggle" aria-expanded="false" aria-label="${esc(e.title)}, more"></button>
        <div class="ch"><span>${esc(e.tag)}</span><span>${esc(e.time)}</span></div>
        <div class="cb"><h3>${esc(e.title)}</h3>
          <div class="where"><span>${esc(e.venue)} · ${esc(e.area)}</span><b>${esc(e.price)}</b></div>
          <div class="more"><div><p class="mono">${when} · ${esc(e.time)}</p>
            <div class="acts"><a class="btn act-c" href="${esc(e.url)}" target="_blank" rel="noopener">${e.cta === 'TICKETS' ? 'TICKETS' : 'DETAILS'} ↗</a><button class="btn btn-line" data-focus>SHOW ON MAP →</button></div></div></div>
        </div></article>`;
    }
    const p = it.p;
    return `<article class="card place ${p.scene}" data-key="${it.key}" ${delay}>
      <button class="toggle" aria-expanded="false" aria-label="${esc(p.name)}, more"></button>
      <div class="cb"><span class="k">${esc(p.kind)} · ${esc(p.area.toUpperCase())}</span><h3>${esc(p.name)}</h3>
        <div class="where"><span>${esc(p.address)}</span></div>
        <div class="more"><div>${p.note ? `<p>${esc(p.note)}</p>` : '<p></p>'}${p.hours ? `<p class="mono">${esc(p.hours)}</p>` : ''}
          <div class="acts"><a class="btn act-c" href="${esc(p.url)}" target="_blank" rel="noopener">OFFICIAL SITE ↗</a><button class="btn btn-line" data-focus>SHOW ON MAP →</button></div></div></div>
      </div></article>`;
  }

  // ---------- Picks: one per scene, one per venue (as in the app's Map) ----------
  function picks(k) {
    const evs = eventsOn(k).filter((e) => nightKey(Date.parse(e.startsAt)) === k);
    const out = [], venues = new Set();
    for (const s of SCENES) {
      const e = evs.find((x) => x.scene === s && !venues.has(x.venue));
      if (e) { out.push(evItem(e)); venues.add(e.venue); continue; }
      const p = D.places.find((x) => x.scene === s && x.note && !venues.has(x.name));
      if (p) { out.push(plItem(p)); venues.add(p.name); }
    }
    return out;
  }

  // ---------- Explore ----------
  const explore = { mode: 'tonight', scene: 'all', night: tonight, open: null };
  let exMap;
  function nightsAhead() {
    const out = [];
    for (let i = 0; i < 21; i++) { const k = addDays(tonight, i); out.push({ k, n: eventsOn(k).length }); }
    return out;
  }
  function exploreItems() {
    const { mode, scene, night } = explore;
    const sc = (x) => scene === 'all' || x.scene === scene;
    if (mode === 'picks') return picks(night).filter(sc);
    if (mode === 'events') return D.events.filter(sc).slice(0, 120).map(evItem);
    if (mode === 'places') return D.places.filter(sc).map(plItem);
    const evs = eventsOn(night).filter(sc).sort((a, b) => runRank(a, night) - runRank(b, night) || a.startsAt.localeCompare(b.startsAt)).map(evItem);
    const pls = D.places.filter(sc).filter((p) => p.note || scene !== 'all').slice(0, mode === 'map' ? 400 : 24).map(plItem);
    return [...evs, ...pls];
  }
  function renderExplore(refit = true) {
    const items = exploreItems();
    const { mode, scene, night } = explore;
    $('#exploreGrid').classList.toggle('map-only', mode === 'map');
    $('#days').hidden = !['tonight', 'map', 'picks'].includes(mode);
    $$('#days .day').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === night)));
    const nEv = items.filter((x) => x.kind === 'event').length, nPl = items.length - nEv;
    const nightName = night === tonight ? 'TONIGHT' : label(night);
    const head = {
      tonight: nEv ? `UPCOMING EVENTS · ${nightName} · ${nEv}${nPl ? ` &nbsp;+&nbsp; PLACES TO GO · ${nPl}` : ''}` : `NO ${scene === 'all' ? '' : CHIP[scene] + ' '}EVENTS LISTED FOR ${nightName} · HERE ARE PLACES TO GO · ${nPl}`,
      map: `${items.length} ON THE MAP · ${nightName}`,
      picks: `PICKS · ${nightName} · ONE PER SCENE · ONE PER VENUE`,
      events: `EVENTS · NEXT ${nEv} · CHECKED ON EACH VENUE’S OWN PAGE`,
      places: `PLACES · ${nPl} · CLUBS, JAZZ ROOMS, LISTENING BARS, NATTY, GALLERIES`,
    }[mode];
    $('#listHead').innerHTML = head;
    $('#mapCount').textContent = `${items.length} ${scene === 'all' ? 'LISTINGS' : CHIP[scene]}`;
    const shown = items.slice(0, 300);
    $('#list').innerHTML = shown.length ? shown.map(cardHTML).join('') : `<p class="empty">NO ${scene === 'all' ? '' : CHIP[scene] + ' '}EVENTS LISTED FOR ${nightName} · TRY ANOTHER NIGHT OR PLACES</p>`;
    $('#list').scrollTop = 0;
    exMap.setPins(items, {
      onEnter: (it) => { const c = $(`.card[data-key="${CSS.escape(it.key)}"]`); c && c.classList.add('hot'); },
      onLeave: (it) => { const c = $(`.card[data-key="${CSS.escape(it.key)}"]`); c && c.classList.remove('hot'); },
      onClick: (it) => openCard(it.key, true),
    });
    explore.items = new Map(items.map((x) => [x.key, x]));
    if (refit && items.length) {
      const near = items.filter((x) => x.lat > 40.64 && x.lat < 40.8 && x.lng > -74.03 && x.lng < -73.88);
      exMap.fit(near.length ? near : items, 0.86, 1.6);
    }
  }
  function openCard(key, fromPin) {
    const it = explore.items.get(key); if (!it) return;
    $$('#list .card.open').forEach((c) => { if (c.dataset.key !== key) { c.classList.remove('open'); $('.toggle', c).setAttribute('aria-expanded', 'false'); } });
    const c = $(`#list .card[data-key="${CSS.escape(key)}"]`);
    exMap.select(key);
    if (c) {
      const open = fromPin ? true : !c.classList.contains('open');
      c.classList.toggle('open', open); $('.toggle', c).setAttribute('aria-expanded', String(open));
      if (fromPin) c.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    } else exMap.showTip(key);
    if (fromPin) exMap.focus(it.lat, it.lng, Math.max(exMap.s, 1.1));
  }
  function initExplore() {
    exMap = new FauveMap($('#exploreMap'));
    $('#sceneChips').innerHTML = ['all', ...SCENES].map((s) => `<button class="chip ${s === 'all' ? '' : 'c-' + s}" data-scene="${s}" aria-pressed="${s === 'all'}">${CHIP[s]}</button>`).join('');
    $('#days').innerHTML = nightsAhead().map(({ k, n }) => {
      const f = fmtShort(k);
      return `<button class="day" data-k="${k}" aria-pressed="false" ${n || k === tonight ? '' : 'disabled'} aria-label="${k === tonight ? 'Tonight' : label(k)}, ${n} events">${k === tonight ? 'TONIGHT' : f.wd}<small>${f.day} ${f.mon} · ${n}</small></button>`;
    }).join('');
    $('#sceneChips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-scene]'); if (!b) return;
      explore.scene = b.dataset.scene;
      $$('#sceneChips .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      setAccent(explore.scene === 'all' ? 'house' : explore.scene);
      renderExplore();
    });
    $('#days').addEventListener('click', (e) => { const b = e.target.closest('.day'); if (!b || b.disabled) return; explore.night = b.dataset.k; renderExplore(); });
    $('#modes').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
    $('#modes').addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const tabs = $$('#modes [role=tab]'); const i = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setMode(n.dataset.mode);
    });
    $('#list').addEventListener('click', (e) => {
      const c = e.target.closest('.card'); if (!c) return;
      if (e.target.closest('[data-focus]')) { const it = explore.items.get(c.dataset.key); exMap.select(c.dataset.key); exMap.focus(it.lat, it.lng, 1.6); setTimeout(() => exMap.showTip(c.dataset.key), reduce ? 0 : 820); return; }
      if (e.target.closest('a')) return;
      openCard(c.dataset.key, false);
    });
    $('#list').addEventListener('pointerover', (e) => { const c = e.target.closest('.card'); if (c) exMap.mark(c.dataset.key, 'hot', true); });
    $('#list').addEventListener('pointerout', (e) => { const c = e.target.closest('.card'); if (c) exMap.mark(c.dataset.key, 'hot', false); });
    $$('#explore .map-ctrl [data-zoom]').forEach((b) => b.addEventListener('click', () => exMap.zoom(+b.dataset.zoom)));
    $('#explore .map-ctrl [data-reset]').addEventListener('click', () => renderExplore(true));
    renderExplore();
  }
  function setMode(m) {
    explore.mode = m;
    $$('#modes [role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === m)));
    renderExplore();
  }

  // ---------- Plan ----------
  const FROM = [
    ['WILLIAMSBURG', 40.7142, -73.9614], ['BUSHWICK', 40.7036, -73.9256], ['LOWER EAST SIDE', 40.7178, -73.9897],
    ['GREENPOINT', 40.7291, -73.9535], ['BED-STUY', 40.6866, -73.9441], ['WEST VILLAGE', 40.7347, -74.0045],
  ];
  const STARTS = ['18:00', '19:00', '20:00', '21:00', '22:00'];
  const PACES = [['ONE DESTINATION', 1], ['TWO STOPS', 2], ['FULL JOURNEY', 3]];
  const NIGHT_ORDER = ['art', 'wine', 'jazz', 'house'];
  const STAY = { art: 45, wine: 75, jazz: 80, house: 120 };
  const plan = { from: 0, start: '20:00', interests: new Set(['wine', 'jazz']), pace: 2, route: [] };
  let planMap;
  const chipBtn = (cls, data, txt, on) => `<button type="button" class="chip ${cls}" ${data} aria-pressed="${on}">${txt}</button>`;
  function renderPlanForm() {
    $('#planFrom').innerHTML = FROM.map(([n], i) => chipBtn('', `data-from="${i}"`, n, i === plan.from)).join('');
    $('#planStart').innerHTML = STARTS.map((t) => chipBtn('', `data-start="${t}"`, t, t === plan.start)).join('');
    $('#planInterests').innerHTML = SCENES.map((s) => chipBtn('c-' + s, `data-int="${s}"`, CHIP[s], plan.interests.has(s))).join('');
    $('#planPace').innerHTML = PACES.map(([n, v]) => chipBtn('', `data-pace="${v}"`, n, v === plan.pace)).join('');
  }
  function buildRoute() {
    const [, flat, flng] = FROM[plan.from];
    const from = { lat: flat, lng: flng };
    const order = NIGHT_ORDER.filter((s) => plan.interests.has(s));
    const seq = Array.from({ length: plan.pace }, (_, i) => order[i % order.length]);
    const night = tonight;
    const [h, m] = plan.start.split(':').map(Number);
    let t = h * 60 + m, at = from;
    const used = new Set(), out = [];
    // The nearest listing in a scene that's on (events) or open (places) when you'd get there.
    const nearest = (scene) => {
      const soon = t + 15;
      const evs = eventsOn(night).filter((e) => e.scene === scene && !used.has(e.venue) && toMin(e.startsAt) <= soon + 90 && toMin(e.endsAt) > soon + 30)
        .map((e) => ({ x: evItem(e), d: km(at, e) - 0.6 }));
      const pls = D.places.filter((p) => p.scene === scene && !used.has(p.name) && openAt(p, night, soon, STAY[scene]))
        .map((p) => ({ x: plItem(p), d: km(at, p) }));
      return [...evs, ...pls].sort((a, b) => a.d - b.d)[0];
    };
    for (const wanted of seq) {
      // Nothing on in that scene at that hour: fall back to the person's other interests.
      const scene = [wanted, ...order.filter((x) => x !== wanted)].find((s) => nearest(s));
      if (!scene) continue;
      const it = nearest(scene).x;
      used.add(it.venue);
      const dist = km(at, it), walk = dist < 2.4;
      const travel = Math.round(walk ? dist * 12.5 : 8 + dist * 3);
      let arrive = t + travel;
      if (it.kind === 'event') arrive = Math.max(arrive, toMin(it.e.startsAt));
      const leave = arrive + STAY[scene];
      out.push({ ...it, arrive, leave, travel, walk, scene });
      t = leave; at = it;
    }
    plan.route = out; plan.fromPt = from;
    return out;
  }
  // Open when you arrive and for at least the first hour, from verified weekly hours (a closing time at or before
  // the opening time is after midnight).
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  function openAt(p, night, arrive, stay) {
    const slots = p.open && p.open[DOW[keyDate(night).getUTCDay()]];
    if (!slots) return false;
    return slots.some(([o, c]) => {
      const m = (t) => { const [h, mi] = t.split(':').map(Number); return h * 60 + mi; };
      const from = m(o);
      // No published closing time is open-ended ("FROM 22:00"), as in the app.
      const to = c == null ? Infinity : m(c) <= from ? m(c) + 1440 : m(c);
      return arrive >= from && arrive + Math.min(stay, 60) <= to;
    });
  }
  function toMin(iso) { const [hh, mm] = hhmm(Date.parse(iso)).split(':').map(Number); let v = hh * 60 + mm; if (v < 300) v += 1440; return v; }
  const clock = (v) => { v = ((v % 1440) + 1440) % 1440; return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; };
  function renderRoute() {
    const r = buildRoute();
    const ol = $('#route');
    if (!r.length) { ol.innerHTML = '<li class="empty">NOTHING ON IN THOSE SCENES AT THAT HOUR · TRY AN EARLIER START OR ANOTHER SCENE</li>'; planMap.setPins([]); planMap.route([], plan.fromPt); renderCrew(); renderFloats(); return; }
    const total = r.reduce((a, s) => a + s.travel, 0);
    ol.innerHTML = `<li class="route-sum">BEST MATCH · ${r.length} ${r.length === 1 ? 'STOP' : 'STOPS'} · ≈ ${total} MIN TRAVEL · ${label(tonight)}</li>` + (r.length < plan.pace ? `<li class="route-sum muted">ONLY ${r.length} OF ${plan.pace} STOPS ARE ON AT THAT HOUR · TRY AN EARLIER START OR MORE INTERESTS</li>` : '') + r.map((s, i) => {
      const kind = s.kind === 'event' ? s.e.tag : s.p.kind;
      const step = `<li class="stop ${s.scene}" style="animation-delay:${i * 160 + 200}ms"><span class="n">${i + 1}</span><div class="sb"><div class="sh"><span>ARRIVE ${clock(s.arrive)}</span><span>${esc(kind)}</span></div>
        <div class="sc"><h3>${esc(s.name)}</h3><p>${esc(s.kind === 'event' ? `${s.e.venue} · ${s.e.area}` : `${s.p.area} · ${s.p.address}`)}</p><p>STAY ≈ ${clock(s.arrive)}–${clock(s.leave)}</p></div></div></li>`;
      const next = r[i + 1];
      const walk = next ? `<li class="walk" style="animation-delay:${i * 160 + 340}ms">↓ ≈ ${next.travel} MIN ${next.walk ? 'WALK' : 'BY SUBWAY'}</li>` : '';
      return step + walk;
    }).join('') + `<li class="route-cta"><a class="btn btn-accent btn-block" href="#crew" data-crew>START A CREW →</a></li>`;
    // Nearby places in the chosen scenes, faint, so the route reads against the neighborhood.
    const ctx = D.places.filter((p) => plan.interests.has(p.scene) && km(plan.fromPt, p) < 3.5).map(plItem);
    planMap.setPins(ctx);
    planMap.items.forEach((x) => x.g.classList.add('dim'));
    planMap.fit([plan.fromPt, ...r], 0.5, 1.1);
    planMap.route(r, plan.fromPt);
    renderCrew(); renderFloats();
  }
  function initPlan() {
    planMap = new FauveMap($('#planMap'), { interactive: false });
    renderPlanForm();
    $('#planForm').addEventListener('click', (e) => {
      const b = e.target.closest('button[type=button]'); if (!b) return;
      if (b.dataset.from) plan.from = +b.dataset.from;
      if (b.dataset.start) plan.start = b.dataset.start;
      if (b.dataset.pace) plan.pace = +b.dataset.pace;
      if (b.dataset.int) { const s = b.dataset.int; plan.interests.has(s) && plan.interests.size > 1 ? plan.interests.delete(s) : plan.interests.add(s); setAccent(s); }
      renderPlanForm();
    });
    $('#planForm').addEventListener('submit', (e) => { e.preventDefault(); renderRoute(); if (innerWidth < 1024) $('#route').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); });
    $('#route').addEventListener('click', (e) => { if (e.target.closest('[data-crew]')) setCrewStep(0); });
    renderRoute();
  }

  // ---------- Crew ----------
  let crewStep = 0, crewTimer = null, crewHover = false;
  function renderCrew() {
    $('#crewDate').textContent = label(tonight);
    const r = plan.route;
    $('#crewStops').innerHTML = r.map((s) => `<li style="--c:${COLOR[s.scene]}"><i></i><div><b>${clock(s.arrive)} · ${esc(CHIP[s.scene])}</b><span>${esc(s.name)}</span></div></li>`).join('');
    $('#shareMsg').textContent = [`Join my crew on FAUVE · ${label(tonight)}`, ...r.map((s) => `${clock(s.arrive)} — ${s.kind === 'event' ? s.venue : s.name}`), '', 'Invite code: ••••••', 'Or in the app: Me › Crews › JOIN A CREW.', `Get FAUVE NYC: ${APP.replace('https://', '')}`].join('\n');
    applyCrewStep();
  }
  function applyCrewStep() {
    $('#crewCards').dataset.step = crewStep;
    const front = ['ccard-plan', 'ccard-invite', 'ccard-plan', 'ccard-share'][crewStep];
    $$('#crewCards .ccard').forEach((c) => c.classList.toggle('back', !c.classList.contains(front)));
    $$('#crewSteps li').forEach((li) => li.classList.toggle('on', +li.dataset.step === crewStep));
    const joined = crewStep >= 2;
    $('#crewMembers').innerHTML = `<i title="You">YOU</i>` + [0, 1, 2].map(() => `<i class="${joined ? 'joined' : 'empty'}">${joined ? '✓' : '+'}</i>`).join('');
    $('#inviteRows').innerHTML = ['FROM PEOPLE YOU FOLLOW', 'FROM YOUR FOLLOWERS', 'SEARCH BY USERNAME'].map((t) => `<li class="${crewStep >= 1 ? 'on' : ''}"><i>+</i>${t}<em>${crewStep >= 2 ? 'JOINED' : crewStep >= 1 ? 'INVITED · PENDING' : ''}</em></li>`).join('');
  }
  function setCrewStep(n) { crewStep = n; applyCrewStep(); }
  function initCrew() {
    $('#crewSteps').addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) setCrewStep(+li.dataset.step); });
    $('#crewStage').addEventListener('pointerenter', () => (crewHover = true));
    $('#crewStage').addEventListener('pointerleave', () => (crewHover = false));
    new IntersectionObserver(([en]) => {
      clearInterval(crewTimer);
      if (en.isIntersecting && !reduce) crewTimer = setInterval(() => { if (!crewHover) setCrewStep((crewStep + 1) % 4); }, 2800);
    }, { threshold: 0.35 }).observe($('#crewStage'));
  }

  // ---------- Hero ----------
  const SWAP = [['house', 'HOUSE/TECHNO'], ['jazz', 'JAZZ'], ['wine', 'NATTY WINE'], ['art', 'ART']];
  let heroIdx = 0, heroVisible = true;
  function renderPhone(scene) {
    const k = tonight;
    $('#phEyebrow').textContent = `${label(k)} · NEW YORK · LIVE`;
    $('#phChips').innerHTML = ['all', ...SCENES].map((s) => `<span style="--c:${s === 'all' ? '#F2F2EE' : COLOR[s]}" class="${s === scene ? 'on' : ''}">${CHIP[s]}</span>`).join('');
    let cards;
    if (scene === 'wine') cards = D.places.filter((p) => p.scene === 'wine' && p.note).slice(0, 7).map((p) => `<div class="ph-card place" style="--c:${COLOR.wine}"><div class="k">${esc(p.kind)} · ${esc(p.area.toUpperCase())}</div><div class="t">${esc(p.name)}</div><div class="m"><span>${esc(p.address)}</span></div></div>`);
    else {
      let evs = eventsOn(k).filter((e) => e.scene === scene);
      if (evs.length < 3) evs = D.events.filter((e) => e.scene === scene);
      cards = evs.slice(0, 6).map((e) => `<div class="ph-card" style="--c:${COLOR[e.scene]}"><div class="h"><span>${esc(e.tag)}</span><span>${esc(e.time)}</span></div><div class="t">${esc(e.title)}</div><div class="m"><span>${esc(e.venue)}</span><span>${esc(e.price)}</span></div></div>`);
    }
    const feed = $('#phFeed'); feed.innerHTML = cards.join(''); feed.classList.remove('cycle'); void feed.offsetWidth; feed.classList.add('cycle');
  }
  // Long words (HOUSE/TECHNO) shrink to the column instead of running off it.
  function fitSwap() {
    const sw = $('#heroSwap'); sw.style.fontSize = '';
    const max = $('.hero-copy').clientWidth, w = sw.getBoundingClientRect().width;
    if (w > max) sw.style.fontSize = `${(max / w) * 0.98}em`;
  }
  function heroCycle() {
    const [scene, word] = SWAP[heroIdx];
    const sw = $('#heroSwap');
    if (heroVisible) setAccent(scene);
    renderPhone(scene);
    if (reduce) { sw.textContent = word; fitSwap(); return; }
    sw.classList.remove('in'); sw.classList.add('out');
    setTimeout(() => { sw.textContent = word; fitSwap(); sw.classList.remove('out'); sw.classList.add('in'); }, 280);
  }
  function renderFloats() {
    const wine = D.places.find((p) => p.scene === 'wine' && p.note && /Brooklyn/.test(p.address)) || D.places[0];
    if (wine) $('.float-pin').innerHTML = `<div class="fl-k" style="--c:${COLOR.wine}">N · ${esc(wine.kind)}</div><div class="fl-t">${esc(wine.name)}</div><div class="fl-m">${esc(wine.area)}</div>`;
    const r = plan.route.slice(0, 2);
    $('.float-route').innerHTML = r.map((s, i) => `<div class="fl-step" style="--c:${COLOR[s.scene]}"><b>${i + 1}</b><span>${esc(s.name)}<small>ARRIVE ${clock(s.arrive)}</small></span></div>${i === 0 && r[1] ? `<div class="fl-walk">↓ ≈ ${r[1].travel} MIN ${r[1].walk ? 'WALK' : 'SUBWAY'}</div>` : ''}`).join('');
    $('.float-crew').innerHTML = `<div class="fl-k">PRIVATE CREW · ${label(tonight)}</div><div class="fl-t">YOUR NIGHT PLAN</div><div class="fl-av"><i>YOU</i><i class="empty">+</i><i class="empty">+</i></div>`;
  }
  function initHero() {
    const week = Array.from({ length: 7 }, (_, i) => addDays(tonight, i));
    const nWeek = new Set(D.events.filter((e) => week.some((k) => onNight(e, k))).map((e) => e.id)).size;
    $('#heroEyebrow').textContent = `${label(tonight)} · NEW YORK · LIVE`;
    $('#heroStats').innerHTML = `<b>${eventsOn(tonight).length}</b> EVENTS TONIGHT · <b>${nWeek}</b> THIS WEEK · <b>${D.places.length}</b> PLACES · <b>4</b> SCENES`;
    renderPhone('house');
    $('#heroSwap').textContent = 'HOUSE/TECHNO';
    document.fonts.ready.then(fitSwap); document.fonts.addEventListener('loadingdone', fitSwap);
    new ResizeObserver(fitSwap).observe($('.hero-copy'));
    if (!reduce) setInterval(() => { heroIdx = (heroIdx + 1) % SWAP.length; heroCycle(); }, 2600);
    new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; if (heroVisible) setAccent(SWAP[heroIdx][0]); }, { threshold: 0.3 }).observe($('.hero'));
    // Depth: the phone and the floating cards follow the pointer, and drift on scroll.
    const layers = $$('#heroStage [data-depth]');
    let mx = 0, my = 0, sy = 0, raf = 0;
    const draw = () => { raf = 0; layers.forEach((l) => { const d = +l.dataset.depth; l.style.transform = `translate3d(${mx * d}px, ${my * d - sy * d * 0.012}px, 0)${l.classList.contains('phone') ? ` rotateY(${mx * -6}deg) rotateX(${my * 5}deg)` : ''}`; }); };
    const ask = () => { if (!raf) raf = requestAnimationFrame(draw); };
    if (!reduce) {
      if (fine) $('.hero').addEventListener('pointermove', (e) => { const r = e.currentTarget.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width - 0.5; my = (e.clientY - r.top) / r.height - 0.5; ask(); });
      addEventListener('scroll', () => { sy = Math.min(scrollY, 900); ask(); }, { passive: true });
    }
  }

  // ---------- Marquee, reveals, nav, cursor, intro ----------
  function initMarquee() {
    const pick = [...D.places.filter((p) => p.note)].sort((a, b) => a.name.localeCompare(b.name)).filter((_, i) => i % 3 === 0).slice(0, 36);
    const html = pick.map((p) => `<span style="--c:${COLOR[p.scene]}"><i></i>${esc(p.name)}</span>`).join('');
    $('#marquee').innerHTML = html + html;
  }
  function initReveals() {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.25 });
    $$('.reveal, .get').forEach((el) => io.observe(el));
    const links = $$('.nav-links a');
    const secIO = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (!en.isIntersecting) return;
      const id = en.target.id;
      links.forEach((a) => a.classList.toggle('on', a.dataset.section === id && (id !== 'explore' || (a.dataset.mode === 'map') === (explore.mode === 'map'))));
    }), { rootMargin: '-45% 0px -50% 0px' });
    ['explore', 'plan', 'crew'].forEach((id) => secIO.observe(document.getElementById(id)));
    $$('a[data-mode="map"]').forEach((a) => a.addEventListener('click', () => setMode('map')));
    $$('.nav-links a[data-section="explore"]:not([data-mode]), .nav-sheet a[href="#explore"]:not([data-mode])').forEach((a) => a.addEventListener('click', () => { if (explore.mode === 'map') setMode('tonight'); }));
    const menu = $('#navMenu'), sheet = $('#navSheet');
    menu.addEventListener('click', () => { const open = sheet.hidden; sheet.hidden = !open; menu.setAttribute('aria-expanded', String(open)); menu.textContent = open ? 'CLOSE' : 'MENU'; });
    sheet.addEventListener('click', (e) => { if (e.target.closest('a')) { sheet.hidden = true; menu.setAttribute('aria-expanded', 'false'); menu.textContent = 'MENU'; } });
    $('#footData').textContent = `LISTINGS UPDATED ${D.generated ? label(D.generated) : ''}`.trim();
  }
  function initCursor() {
    if (!fine || reduce) return;
    const cur = $('.cursor'); cur.classList.add('on'); let x = -100, y = -100, cx = -100, cy = -100;
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; cur.classList.toggle('big', !!e.target.closest('a, button, .pin, .card, .day')); }, { passive: true });
    const tick = () => { cx += (x - cx) * 0.22; cy += (y - cy) * 0.22; cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(tick); };
    tick();
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('pointermove', (e) => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`; });
      b.addEventListener('pointerleave', () => (b.style.transform = ''));
    });
  }
  function initIntro() {
    const intro = $('#intro');
    let seen = false; try { seen = sessionStorage.getItem('fauve-intro') === '1'; } catch { /* private mode */ }
    const finish = () => { intro.classList.add('done'); document.body.classList.add('ready'); setTimeout(() => intro.remove(), 300); };
    if (reduce || seen) { intro.remove(); document.body.classList.add('ready'); return; }
    try { sessionStorage.setItem('fauve-intro', '1'); } catch { /* private mode */ }
    const t = setTimeout(finish, 2950);
    intro.addEventListener('click', () => { clearTimeout(t); intro.classList.add('skip-now'); finish(); });
  }

  initIntro();
  initHero();
  initMarquee();
  initExplore();
  initPlan();
  initCrew();
  initReveals();
  initCursor();
})();
