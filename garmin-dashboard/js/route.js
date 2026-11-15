/* Routenplaner: Leaflet-Karte, Routing über BRouter (Fallback OSRM), GPX-Export für Komoot */
'use strict';

const RT = {
  map: null, layer: null, markers: [], line: null, sport: 'run', mode: 'loop', target: { type: 'km', value: 10 },
  start: null, wps: [], route: null, seed: 1, token: 0, okProfile: {}, home: null, status: '', saved: lsGet(ROUTES, [])
};
const RT_SPORTS = { run: { label: 'Laufen', gpx: 'running', profiles: ['hiking-mountain', 'hiking-beta', 'trekking'], osrm: 'routed-foot', climb: 0.6 },
  gravel: { label: 'Gravel', gpx: 'cycling', profiles: ['gravel', 'trekking', 'fastbike'], osrm: 'routed-bike', climb: 0.9 },
  mtb: { label: 'Mountainbike', gpx: 'cycling', profiles: ['MTB', 'mtb', 'trekking'], osrm: 'routed-bike', climb: 1.0 },
  road: { label: 'Rennrad', gpx: 'cycling', profiles: ['fastbike', 'trekking'], osrm: 'routed-bike', climb: 0.8 } };

/* ---------- Geometrie ---------- */
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
function hav(a, b) { const R = 6371000, dLat = toRad(b[0] - a[0]), dLon = toRad(b[1] - a[1]); const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
function dest(p, bearingDeg, m) { const R = 6371000, br = toRad(bearingDeg), la = toRad(p[0]), lo = toRad(p[1]), d = m / R; const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(br)); const lo2 = lo + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)); return [toDeg(la2), toDeg(lo2)]; }
function bearing(a, b) { const y = Math.sin(toRad(b[1] - a[1])) * Math.cos(toRad(b[0])), x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(toRad(b[1] - a[1])); return (toDeg(Math.atan2(y, x)) + 360) % 360; }

function analyse(coords) {
  let dist = 0, up = 0, down = 0, ref = coords[0]?.[2], cum = [0];
  for (let i = 1; i < coords.length; i++) {
    dist += hav(coords[i - 1], coords[i]); cum.push(dist);
    const e = coords[i][2]; if (e == null || ref == null) { ref = e ?? ref; continue; }
    if (e - ref >= 3) { up += e - ref; ref = e; } else if (ref - e >= 3) { down += ref - e; ref = e; }
  }
  return { dist, up, down, cum };
}
function speedFor(sport) {
  const pm = paceModel();
  if (sport === 'run') return 1000 / pm.avgPace;
  return (pm.speed[sport] || 20) / 3.6;
}
function estTime(sport, dist, up) { return dist / speedFor(sport) + up * RT_SPORTS[sport].climb; }

/* ---------- Routing ---------- */
async function getJSON(url, ms = 20000) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.json(); } finally { clearTimeout(t); }
}
async function routeBRouter(pts, sport) {
  const S = RT_SPORTS[sport]; const lonlats = pts.map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join('|');
  const list = RT.okProfile[sport] ? [RT.okProfile[sport]] : S.profiles; let lastErr;
  for (const prof of list) {
    try {
      const j = await getJSON(`https://brouter.de/brouter?lonlats=${lonlats}&profile=${prof}&alternativeidx=0&format=geojson`);
      const g = j.features?.[0]?.geometry?.coordinates; if (!g || g.length < 2) throw new Error('leere Route');
      RT.okProfile[sport] = prof; return { coords: g.map(c => [c[1], c[0], c[2] != null ? +c[2] : null]), via: 'BRouter · ' + prof };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('BRouter nicht erreichbar');
}
async function routeOSRM(pts, sport) {
  const s = pts.map(p => `${p[1].toFixed(6)},${p[0].toFixed(6)}`).join(';');
  const j = await getJSON(`https://routing.openstreetmap.de/${RT_SPORTS[sport].osrm}/route/v1/driving/${s}?overview=full&geometries=geojson`);
  const g = j.routes?.[0]?.geometry?.coordinates; if (!g) throw new Error('keine Route');
  return { coords: g.map(c => [c[1], c[0], null]), via: 'OSRM (ohne Höhen)' };
}
async function addElevation(coords) {
  if (coords.every(c => c[2] != null)) return coords;
  try {
    const n = Math.min(100, coords.length), idx = Array.from({ length: n }, (_, i) => Math.round(i * (coords.length - 1) / (n - 1)));
    const j = await getJSON(`https://api.open-meteo.com/v1/elevation?latitude=${idx.map(i => coords[i][0].toFixed(5)).join(',')}&longitude=${idx.map(i => coords[i][1].toFixed(5)).join(',')}`, 12000);
    const el = j.elevation; if (!el) return coords;
    return coords.map((c, k) => { let a = 0; while (a < idx.length - 2 && idx[a + 1] < k) a++; const f = (k - idx[a]) / Math.max(1, idx[a + 1] - idx[a]); return [c[0], c[1], el[a] + (el[a + 1] - el[a]) * clamp(f, 0, 1)]; });
  } catch { return coords; }
}
async function routeVia(pts, sport) {
  let r; try { r = await routeBRouter(pts, sport); } catch (e1) { r = await routeOSRM(pts, sport); r.coords = await addElevation(r.coords); }
  return r;
}

/* ---------- Rundkurs-Erzeugung ---------- */
function targetValue(r, sport) { return RT.target.type === 'min' ? estTime(sport, r.dist, r.up) / 60 : r.dist / 1000; }
function targetGoal() { return RT.target.value; }
function targetDistGuess(sport) { return RT.target.type === 'min' ? RT.target.value * 60 * speedFor(sport) * 0.9 : RT.target.value * 1000; }

async function buildAuto(token) {
  const sport = RT.sport, start = RT.start; const circ = RT.mode === 'out' ? 1.25 : 1.35;
  const goalM = targetDistGuess(sport);
  let r = RT.mode === 'out' ? goalM / 2 / circ : goalM / (2 * Math.PI) / circ * 1.0;
  const b0 = (RT.seed * 137.5) % 360; let best = null;
  for (let it = 0; it < 5; it++) {
    if (token !== RT.token) return null;
    let via, closing = [];
    if (RT.mode === 'out') { via = [dest(start, b0, r)]; }
    else { const c = dest(start, b0, r), a0 = bearing(c, start); via = [90, 180, 270].map(a => dest(c, (a0 + a) % 360, r)); }
    setStatus(`Berechne Route … (${it + 1}/5)`);
    let res;
    if (RT.mode === 'out') { const outPath = await routeVia([start, via[0]], sport); res = { coords: outPath.coords.concat(outPath.coords.slice().reverse().slice(1)), via: outPath.via }; }
    else res = await routeVia([start, ...via, start], sport);
    res.coords = await addElevation(res.coords);
    const a = analyse(res.coords); res = { ...res, ...a };
    const val = targetValue(res, sport), goal = targetGoal(); const err = Math.abs(val / goal - 1);
    if (!best || err < best.err) best = { res, err, via };
    if (err < 0.07) break;
    r *= clamp(goal / val, 0.5, 1.8);
  }
  RT.wps = best.via.map(v => v);
  return best.res;
}

async function buildManual(token) {
  const pts = [RT.start, ...RT.wps]; if (RT.closeLoop && RT.wps.length) pts.push(RT.start);
  if (pts.length < 2) return null;
  setStatus('Berechne Route …');
  let res = await routeVia(pts, RT.sport); if (token !== RT.token) return null;
  res.coords = await addElevation(res.coords); return { ...res, ...analyse(res.coords) };
}

async function computeRoute() {
  if (!RT.start) { setStatus('Setze zuerst einen Startpunkt (Karte antippen oder Ort suchen).', true); return; }
  const token = ++RT.token;
  try {
    const res = RT.mode === 'manual' ? await buildManual(token) : await buildAuto(token);
    if (token !== RT.token) return;
    if (!res) { setStatus('Tippe auf die Karte, um Zwischenpunkte zu setzen.'); return; }
    RT.route = res; drawRoute(); setStatus(`Route fertig (${res.via}).`);
  } catch (e) { setStatus('Routing nicht möglich: ' + (e.name === 'AbortError' ? 'Zeitüberschreitung' : e.message) + '. Prüfe deine Internetverbindung.', true); }
}

/* ---------- Karte zeichnen ---------- */
const mkIcon = (cls, txt) => L.divIcon({ className: '', html: `<div class="mk ${cls}">${txt}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
function setStatus(t, err = false) { RT.status = t; const el = $('#rt-status'); if (el) { el.textContent = t; el.className = 'status' + (err ? ' err' : ''); } }

function drawMarkers() {
  RT.markers.forEach(m => RT.map.removeLayer(m)); RT.markers = [];
  if (!RT.start) return;
  const s = L.marker(RT.start, { icon: mkIcon('start', 'S'), draggable: true, zIndexOffset: 500 }).addTo(RT.map);
  s.on('dragend', e => { const p = e.target.getLatLng(); RT.start = [p.lat, p.lng]; computeRoute(); });
  RT.markers.push(s);
  if (RT.mode === 'manual') RT.wps.forEach((w, i) => {
    const m = L.marker(w, { icon: mkIcon(i === RT.wps.length - 1 && !RT.closeLoop ? 'end' : '', i + 1), draggable: true }).addTo(RT.map);
    m.on('dragend', e => { const p = e.target.getLatLng(); RT.wps[i] = [p.lat, p.lng]; computeRoute(); });
    m.on('contextmenu', () => { RT.wps.splice(i, 1); computeRoute(); drawMarkers(); });
    RT.markers.push(m);
  });
}
function drawRoute() {
  if (RT.line) RT.map.removeLayer(RT.line);
  drawMarkers();
  const R = RT.route; if (!R) { updateStats(); return; }
  RT.line = L.polyline(R.coords.map(c => [c[0], c[1]]), { color: cv('--accent'), weight: 5, opacity: .9 }).addTo(RT.map);
  RT.map.fitBounds(RT.line.getBounds(), { padding: [30, 30] });
  updateStats();
}
function updateStats() {
  const R = RT.route, box = $('#rt-stats'); if (!box) return;
  if (!R) { box.innerHTML = ''; destroyProfile(); return; }
  const t = estTime(RT.sport, R.dist, R.up);
  box.innerHTML = `<div class="stat"><b>${fmtKm(R.dist)} km</b><span>Distanz</span></div><div class="stat"><b>${fmtDur(t)}</b><span>geschätzte Dauer${RT.sport === 'run' ? ` · Ø ${fmtPace(t / (R.dist / 1000))} /km` : ` · Ø ${nf(R.dist / t * 3.6, 1)} km/h`}</span></div><div class="stat"><b>↑ ${nf(R.up)} m</b><span>Anstieg</span></div><div class="stat"><b>↓ ${nf(R.down)} m</b><span>Abstieg</span></div>`;
  drawProfile();
}
function destroyProfile() { const c = $('#rt-prof'); if (c && c._chart) { c._chart.destroy(); Charts.all = Charts.all.filter(x => x !== c._chart); } }
function drawProfile() {
  const R = RT.route, cvs = $('#rt-prof'); if (!cvs) return; destroyProfile();
  if (!R.coords.some(c => c[2] != null)) { cvs.parentElement.style.display = 'none'; return; } cvs.parentElement.style.display = '';
  const n = Math.min(120, R.coords.length), idx = Array.from({ length: n }, (_, i) => Math.round(i * (R.coords.length - 1) / (n - 1)));
  const ch = lineChart(cvs, idx.map(i => nf(R.cum[i] / 1000, 1)), [{ label: 'Höhe', data: idx.map(i => R.coords[i][2] != null ? Math.round(R.coords[i][2]) : null), color: 0, fill: true, width: 2 }], { unit: 'm', xTicks: 6 });
  ch.data.datasets[0].backgroundColor = cv('--s1') + '33'; ch.options.plugins.tooltip.callbacks.title = it => it[0].label + ' km'; ch.update();
}

/* ---------- GPX / Teilen ---------- */
function gpxText(name) {
  const R = RT.route, S = RT_SPORTS[RT.sport];
  const pts = R.coords.map(c => `<trkpt lat="${c[0].toFixed(6)}" lon="${c[1].toFixed(6)}">${c[2] != null ? `<ele>${c[2].toFixed(1)}</ele>` : ''}</trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Garmin Dashboard" xmlns="http://www.topografix.com/GPX/1/1">\n<metadata><name>${esc(name)}</name></metadata>\n<trk><name>${esc(name)}</name><type>${S.gpx}</type><trkseg>\n${pts}\n</trkseg></trk>\n</gpx>\n`;
}
const routeName = () => `${RT_SPORTS[RT.sport].label} ${nf(RT.route.dist / 1000, 1)} km`;
const fileName = () => `${routeName().toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/-+$/, '')}.gpx`;
function downloadGpx() {
  const blob = new Blob([gpxText(routeName())], { type: 'application/gpx+xml' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = fileName(); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
async function shareGpx() {
  const file = new File([gpxText(routeName())], fileName(), { type: 'application/gpx+xml' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: routeName() }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  downloadGpx(); setStatus('Teilen wird hier nicht unterstützt – GPX wurde heruntergeladen. Öffne sie danach in Komoot.');
}
function saveRoute() {
  const R = RT.route; if (!R) return; const step = Math.max(1, Math.ceil(R.coords.length / 500));
  RT.saved.unshift({ id: Date.now(), name: routeName(), sport: RT.sport, dist: R.dist, up: R.up, down: R.down, coords: R.coords.filter((_, i) => i % step === 0 || i === R.coords.length - 1).map(c => [+c[0].toFixed(5), +c[1].toFixed(5), c[2] != null ? Math.round(c[2]) : null]) });
  RT.saved = RT.saved.slice(0, 30); lsSet(ROUTES, RT.saved); drawSaved();
}
function drawSaved() {
  const box = $('#rt-saved'); if (!box) return;
  box.innerHTML = RT.saved.length ? RT.saved.map(r => `<div class="it"><span>${esc(r.name)} · ↑${nf(r.up)} m</span><span><button class="btn small" data-load="${r.id}">Laden</button> <button class="btn small gray" data-del="${r.id}" aria-label="Route löschen">${sym('close')}</button></span></div>`).join('') : '<span class="sub">Noch keine gespeicherten Routen.</span>';
  $$('[data-load]', box).forEach(b => b.addEventListener('click', () => { const r = RT.saved.find(x => x.id == b.dataset.load); RT.sport = r.sport; RT.route = { coords: r.coords, via: 'gespeichert', ...analyse(r.coords) }; RT.start = r.coords[0].slice(0, 2); RT.wps = []; RT.mode = 'manual'; RT.closeLoop = false; syncControls(); drawRoute(); setStatus('Gespeicherte Route geladen.'); }));
  $$('[data-del]', box).forEach(b => b.addEventListener('click', () => { RT.saved = RT.saved.filter(x => x.id != b.dataset.del); lsSet(ROUTES, RT.saved); drawSaved(); }));
}

/* ---------- Suche / Standort ---------- */
async function geocode(q) { return getJSON(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=de`, 12000); }
function homeGuess() {
  const cnt = {}; App.data.acts.forEach(a => { const n = a.name.replace(/\s+(Laufen|Gehen|Radfahren|Mountainbiken|Gravel.*|Wandern|Walking|Running|Cycling)$/i, '').trim(); if (n && n.length > 2 && n !== a.name) cnt[n] = (cnt[n] || 0) + 1; });
  return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}
function placeStart(latlng, center = false) { RT.start = [latlng[0], latlng[1]]; RT.route = null; if (RT.line) { RT.map.removeLayer(RT.line); RT.line = null; } drawMarkers(); updateStats(); if (center) RT.map.setView(RT.start, 14); }

/* ---------- UI ---------- */
function syncControls() {
  $$('[data-sport]').forEach(b => b.setAttribute('aria-pressed', b.dataset.sport === RT.sport));
  $$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === RT.mode));
  $$('[data-tt2]').forEach(b => b.setAttribute('aria-pressed', b.dataset.tt2 === RT.target.type));
  const v = $('#rt-val'); if (v) v.value = RT.target.value;
  const u = $('#rt-unit'); if (u) u.textContent = RT.target.type === 'km' ? 'km' : 'min';
  $('#rt-auto').hidden = RT.mode === 'manual'; $('#rt-manual').hidden = RT.mode !== 'manual';
  const g = $('#rt-guess'); if (g) { const d = targetDistGuess(RT.sport); g.textContent = RT.target.type === 'min' ? `≈ ${nf(d / 1000 / 0.9, 1)} km bei deinem Ø-Tempo (${RT.sport === 'run' ? fmtPace(1000 / speedFor('run')) + ' /km' : nf(speedFor(RT.sport) * 3.6, 1) + ' km/h'})` : `≈ ${fmtDur(estTime(RT.sport, RT.target.value * 1000, 0))} bei deinem Ø-Tempo`; }
  drawMarkers();
}

function renderRoutes(el) {
  const pre = App.routePrefill; App.routePrefill = null;
  if (pre) { RT.sport = pre.sport === 'str' ? 'run' : (RT_SPORTS[pre.sport] ? pre.sport : 'run'); RT.mode = RT.mode === 'manual' ? 'loop' : RT.mode; RT.target = pre.min && RT_SPORTS[RT.sport] && RT.sport !== 'run' ? { type: 'min', value: pre.min } : { type: 'km', value: pre.km || 10 }; RT.route = null; }
  el.innerHTML = `<div class="route-grid">
    <div class="panel card" style="grid-column:auto;align-self:start">
      <div><div class="sublabel">Sportart</div><div class="seg">${Object.entries(RT_SPORTS).map(([k, v]) => `<button data-sport="${k}">${v.label}</button>`).join('')}</div></div>
      <div><div class="sublabel">Art der Route</div><div class="seg"><button data-mode="loop">Rundkurs</button><button data-mode="out">Hin &amp; zurück</button><button data-mode="manual">Selbst zeichnen</button></div></div>
      <div id="rt-auto"><div class="sublabel">Vorgabe</div>
        <div class="row"><div class="seg"><button data-tt2="km">Strecke</button><button data-tt2="min">Zeit</button></div>
          <label class="f" style="flex:1;min-width:90px"><span class="sr">Wert</span><span style="display:flex;gap:6px;align-items:center"><input id="rt-val" type="number" min="1" max="400" step="1" inputmode="decimal" style="width:90px"><b id="rt-unit">km</b></span></label></div>
        <div class="sub" id="rt-guess" style="margin-top:6px"></div></div>
      <div id="rt-manual" hidden class="help">Tippe auf die Karte, um Punkte zu setzen. Punkte lassen sich ziehen; langer Druck/Rechtsklick auf einen Punkt entfernt ihn.
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px"><input type="checkbox" id="rt-close"> zurück zum Start (Rundkurs schließen)</label>
        <div class="row" style="margin-top:8px"><button class="btn small" id="rt-undo">Letzten Punkt entfernen</button></div></div>
      <div><div class="sublabel">Startpunkt</div>
        <div class="row"><input type="search" id="rt-q" placeholder="Ort oder Adresse" style="flex:1;min-width:140px"><button class="btn gray" id="rt-find">${sym('search')}Suchen</button><button class="btn gray" id="rt-loc" title="Meinen Standort verwenden" aria-label="Meinen Standort verwenden">${sym('locate')}</button></div>
        <div id="rt-hits" class="saved" style="margin-top:6px"></div></div>
      <div class="row"><button class="btn primary" id="rt-go">Route berechnen</button><button class="btn gray" id="rt-alt">${sym('refresh')}Variante</button><button class="btn gray" id="rt-clear">Zurücksetzen</button></div>
      <div class="status" id="rt-status" role="status"></div>
      <div class="stats" id="rt-stats"></div>
      <div class="chart short"><canvas id="rt-prof" role="img" aria-label="Höhenprofil"></canvas></div>
      <div class="row"><button class="btn primary" id="rt-gpx">${sym('download')}GPX für Komoot</button><button class="btn" id="rt-share">${sym('share')}Teilen</button><button class="btn gray" id="rt-save">${sym('bookmark')}Sichern</button></div>
      <div class="help"><b>In Komoot laden</b> – Komoot hat keine offene Schnittstelle, deshalb läuft es über die GPX-Datei:
        <ol><li><b>iPhone/iPad:</b> „Teilen …“ → <i>Komoot</i> wählen (alternativ: GPX laden, in <i>Dateien</i> antippen → Teilen → Komoot).</li>
        <li><b>Windows:</b> „GPX für Komoot“ drücken, dann auf <a href="https://www.komoot.com/plan" target="_blank" rel="noopener">komoot.com/plan</a> die Datei importieren bzw. ins Planer-Fenster ziehen. Menünamen können sich bei Komoot ändern.</li></ol></div>
      <div><div class="sublabel">Gespeicherte Routen</div><div class="saved" id="rt-saved"></div></div>
    </div>
    <div><div id="map" role="application" aria-label="Karte"></div><p class="note">Kartendaten © OpenStreetMap-Mitwirkende · Routing: BRouter (Profile: Laufen/Wandern, Gravel, MTB, Rennrad). Erstmaliges Laden braucht Internet.</p></div>
  </div>`;
  initMap(); bindRouteUi(); syncControls(); drawSaved();
  if (RT.route) drawRoute();
  if (pre && RT.start) computeRoute();
  else if (pre) setStatus('Startpunkt wählen – dann „Route berechnen“.');
}

function initMap() {
  if (RT.map) { RT.map.remove(); RT.map = null; }
  const c = RT.start || RT.home || [48.78, 9.18];
  RT.map = L.map('map', { zoomControl: true }).setView(c, RT.start ? 13 : 11);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(RT.map);
  RT.map.on('click', e => {
    const p = [e.latlng.lat, e.latlng.lng];
    if (!RT.start) { placeStart(p); setStatus('Startpunkt gesetzt.'); return; }
    if (RT.mode === 'manual') { RT.wps.push(p); computeRoute(); drawMarkers(); }
    else { placeStart(p); setStatus('Startpunkt verschoben – „Route berechnen“.'); }
  });
  if (RT.start) drawMarkers();
  setTimeout(() => RT.map && RT.map.invalidateSize(), 150);
  if (!RT.start && !RT.home) { const g = homeGuess(); if (g) geocode(g).then(h => { if (h[0] && RT.map) { RT.home = [+h[0].lat, +h[0].lon]; if (!RT.start) { RT.map.setView(RT.home, 12); } } }).catch(() => { }); }
}

function bindRouteUi() {
  $$('[data-sport]').forEach(b => b.addEventListener('click', () => { RT.sport = b.dataset.sport; syncControls(); if (RT.start && RT.route) computeRoute(); }));
  $$('[data-mode]').forEach(b => b.addEventListener('click', () => { RT.mode = b.dataset.mode; RT.route = null; if (RT.line) { RT.map.removeLayer(RT.line); RT.line = null; } RT.wps = []; syncControls(); updateStats(); }));
  $$('[data-tt2]').forEach(b => b.addEventListener('click', () => { RT.target.type = b.dataset.tt2; RT.target.value = RT.target.type === 'km' ? 10 : 60; syncControls(); }));
  $('#rt-val').addEventListener('input', e => { RT.target.value = clamp(+e.target.value || 1, 1, 400); syncControls(); $('#rt-val').value = e.target.value; });
  $('#rt-close').addEventListener('change', e => { RT.closeLoop = e.target.checked; if (RT.wps.length) computeRoute(); });
  $('#rt-undo').addEventListener('click', () => { RT.wps.pop(); RT.wps.length ? computeRoute() : (RT.route = null, drawRoute()); drawMarkers(); });
  $('#rt-go').addEventListener('click', () => computeRoute());
  $('#rt-alt').addEventListener('click', () => { RT.seed++; computeRoute(); });
  $('#rt-clear').addEventListener('click', () => { RT.route = null; RT.wps = []; RT.start = null; if (RT.line) { RT.map.removeLayer(RT.line); RT.line = null; } drawMarkers(); updateStats(); setStatus('Zurückgesetzt. Tippe auf die Karte für einen neuen Start.'); });
  const find = async () => { const q = $('#rt-q').value.trim(); if (!q) return; const box = $('#rt-hits'); box.innerHTML = '<span class="sub">Suche …</span>'; try { const h = await geocode(q); box.innerHTML = h.length ? h.map((x, i) => `<div class="it"><span>${esc(x.display_name.slice(0, 70))}</span><button class="btn small" data-hit="${i}">Start hier</button></div>`).join('') : '<span class="sub">Nichts gefunden.</span>'; $$('[data-hit]', box).forEach(b => b.addEventListener('click', () => { const x = h[b.dataset.hit]; placeStart([+x.lat, +x.lon], true); box.innerHTML = ''; setStatus('Startpunkt gesetzt – „Route berechnen“.'); })); } catch (e) { box.innerHTML = '<span class="status err">Ortssuche nicht erreichbar.</span>'; } };
  $('#rt-find').addEventListener('click', find); $('#rt-q').addEventListener('keydown', e => { if (e.key === 'Enter') find(); });
  $('#rt-loc').addEventListener('click', () => { if (!navigator.geolocation) return setStatus('Standort wird nicht unterstützt.', true); setStatus('Standort wird bestimmt …'); navigator.geolocation.getCurrentPosition(p => { placeStart([p.coords.latitude, p.coords.longitude], true); setStatus('Startpunkt = dein Standort.'); }, () => setStatus('Standort nicht verfügbar (Berechtigung?).', true), { enableHighAccuracy: true, timeout: 12000 }); });
  const need = f => () => RT.route ? f() : setStatus('Berechne zuerst eine Route.', true);
  $('#rt-gpx').addEventListener('click', need(downloadGpx)); $('#rt-share').addEventListener('click', need(shareGpx)); $('#rt-save').addEventListener('click', need(() => { saveRoute(); setStatus('Route gespeichert.'); }));
}
