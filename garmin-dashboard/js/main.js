/* Start, Navigation, Import/Export, automatische Aktualisierung, Einstellungen */
'use strict';

const PAGES = { today: ['Heute', renderToday], review: ['Rückblick', renderReview], train: ['Training', renderTrain] };
App.page = (location.hash.slice(1) in PAGES) ? location.hash.slice(1) : 'today';
App.fcMode = 'plan'; App.range = '8w';

const toast = (t, ms = 2800) => { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), ms); };

function render() {
  destroyCharts();
  const view = $('#view'); window.scrollTo({ top: 0 });
  $$('.nav [data-page]').forEach(b => b.dataset.page === App.page ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (!App.data) { view.innerHTML = emptyHtml(); bindEmpty(); } else {
    try { PAGES[App.page][1](view); } catch (e) { console.error(e); view.innerHTML = `<div class="banner">${sym('warn')}<div><b>Anzeigefehler:</b> ${esc(e.message)}</div></div>`; }
  }
  $('#nb-title').textContent = PAGES[App.page][0]; onScroll(); updateStale();
}
function go(p) { App.page = p; history.replaceState(null, '', '#' + p); render(); }
const onScroll = () => $('#navbar').classList.toggle('scrolled', window.scrollY > 36);
function updateStale() { const b = $('#badge-stale'); if (b) b.hidden = !(App.data && diffDays(realToday(), App.data.asOf) >= 1); }

function emptyHtml() {
  return `<div class="empty">${badge('wave', 'blue')}<h1 class="t-large">Willkommen</h1><p>Noch keine Garmin-Daten geladen. Importiere die Datei <b>garmin-data.json</b> oder einen CSV-Export deiner Aktivitäten aus Garmin Connect.</p>
  <button class="btn primary" id="e-import">Daten importieren</button></div>`;
}
function bindEmpty() { $('#e-import')?.addEventListener('click', openSettings); }

/* ---------- Import ---------- */
function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false; text = text.replace(/^﻿/, '');
  const sepGuess = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === sepGuess) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); } return rows.filter(r => r.length > 1);
}
const numDE = s => { if (s == null || s === '' || s === '--') return null; const t = String(s).replace(/\./g, m => /\d{3}/.test(s) && !/,/.test(s) && s.split('.').length > 2 ? '' : '.').replace(',', '.'); const v = parseFloat(t.replace(/[^\d.\-]/g, '')); return isNaN(v) ? null : v; };
const hms = s => { if (!s || s === '--') return 0; const p = String(s).split(':').map(parseFloat); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : 0; };
function activitiesFromCSV(text) {
  const rows = parseCSV(text); if (rows.length < 2) throw new Error('CSV ist leer');
  const h = rows[0].map(x => x.toLowerCase().trim()); const col = re => h.findIndex(x => re.test(x));
  const ci = { type: col(/aktivitätstyp|activity type/), date: col(/^datum|^date/), title: col(/titel|title/), dist: col(/^distanz|^distance/), dur: col(/^zeit|^time|dauer/), hr: col(/^ø hf|avg hr|durchschn.*herz/), hrMax: col(/^max\.? hf|max hr/), kcal: col(/kalorien|calories/), elev: col(/aufstieg|total ascent/) };
  if (ci.date < 0 || ci.dist < 0) throw new Error('Spalten „Datum“ und „Distanz“ nicht gefunden – bitte den Aktivitäten-CSV-Export aus Garmin Connect verwenden.');
  return rows.slice(1).map(r => ({ t: (r[ci.date] || '').replace(' ', 'T').slice(0, 19), type: r[ci.type] || '', name: r[ci.title] || r[ci.type] || '', dist: (numDE(r[ci.dist]) || 0) * 1000, dur: hms(r[ci.dur]), hr: numDE(r[ci.hr]), hrMax: numDE(r[ci.hrMax]), kcal: numDE(r[ci.kcal]), elev: numDE(r[ci.elev]) || 0 })).filter(a => /^\d{4}-\d\d-\d\d/.test(a.t));
}
function rawFromState() {
  const D = App.data; return { version: 1, source: D.source, generated: D.generated, profile: D.profile, today: D.today, predictions: D.pred, activities: D.acts.map(a => ({ t: a.t, type: a.type, name: a.name, dist: a.dist, dur: a.dur, hr: a.hr, hrMax: a.hrMax, kcal: a.kcal, elev: a.elev })), daily: D.daily };
}
async function importFile(file) {
  const text = await file.text(); const msg = $('#imp-msg');
  try {
    if (/\.csv$/i.test(file.name) || (!/^\s*[{\[]/.test(text))) {
      const acts = activitiesFromCSV(text); const base = App.data ? rawFromState() : { version: 1, activities: [], daily: [] };
      const have = new Set((base.activities || []).map(a => a.t)); const add = acts.filter(a => !have.has(a.t));
      base.activities = (base.activities || []).concat(add); base.generated = new Date().toISOString().slice(0, 19);
      setData(base); msg.textContent = `${add.length} neue Aktivitäten aus CSV übernommen (${acts.length - add.length} schon vorhanden).`;
    } else { setData(JSON.parse(text)); msg.textContent = `Importiert: ${App.data.acts.length} Aktivitäten, ${App.data.daily.length} Tage.`; }
    msg.className = 'status'; render();
  } catch (e) { msg.textContent = 'Import fehlgeschlagen: ' + e.message; msg.className = 'status err'; }
}
function exportData() {
  const blob = new Blob([JSON.stringify(rawFromState())], { type: 'application/json' }); const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'garmin-data.json'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* ---------- Automatische Aktualisierung ----------
   Quelle (in dieser Reihenfolge): eigene Daten-URL aus den Einstellungen, sonst die Datei data/garmin-data.json neben der App.
   Eine Daten-URL kann eine normale https-Adresse sein oder  github:besitzer/repo/pfad/datei.json[@branch]  (privates Repo + Lese-Token). */
const SYNC = { busy: false, last: null, err: null, timer: null, lastKind: null };
async function fetchRemote() {
  const url = (App.prefs.syncUrl || '').trim(), tok = (App.prefs.syncToken || '').trim();
  if (url) {
    let u = url; const headers = {};
    const m = url.match(/^github:([^/]+)\/([^/]+)\/(.+?)(?:@(.+))?$/i);
    if (m) { u = `https://api.github.com/repos/${m[1]}/${m[2]}/contents/${m[3]}${m[4] ? '?ref=' + encodeURIComponent(m[4]) : ''}`; headers.Accept = 'application/vnd.github.raw+json'; }
    if (tok) headers.Authorization = 'Bearer ' + tok;
    const r = await fetch(u, { headers, cache: 'no-store' });
    if (!r.ok) throw new Error(r.status === 404 ? 'Datei nicht gefunden (404)' : r.status === 401 || r.status === 403 ? 'Zugriff verweigert – Token prüfen' : 'HTTP ' + r.status);
    SYNC.lastKind = 'url'; return await r.json();
  }
  const r = await fetch('data/garmin-data.json?_=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) return null; SYNC.lastKind = 'file'; return await r.json();
}
async function refreshData({ manual = false } = {}) {
  if (SYNC.busy) return; SYNC.busy = true; $('#btn-refresh').classList.add('spin');
  try {
    const raw = await fetchRemote(); SYNC.last = new Date(); SYNC.err = null; const hadData = !!App.data;
    if (!raw) { if (manual) toast('Keine Datenquelle eingerichtet – siehe „Daten“'); }
    else if (!App.data || (raw.generated || '') > (App.data.generated || '')) { setData(raw); const keep = window.scrollY; render(); window.scrollTo({ top: keep }); if (hadData) toast('Daten aktualisiert'); }
    else if (manual) toast('Daten sind aktuell');
  } catch (e) { SYNC.err = e.name === 'TypeError' ? 'Keine Verbindung' : e.message; if (manual) toast('Aktualisierung fehlgeschlagen: ' + SYNC.err, 4000); }
  finally { SYNC.busy = false; $('#btn-refresh').classList.remove('spin'); updateStale(); const s = $('#sync-status'); if (s) s.textContent = syncText(); }
}
const syncText = () => SYNC.err ? `Fehler: ${SYNC.err}` : SYNC.last ? `Zuletzt geprüft um ${SYNC.last.toTimeString().slice(0, 5)} Uhr${App.data?.generated ? ` · Datenstand ${App.data.generated.slice(0, 16).replace('T', ', ')} Uhr` : ''}` : 'Noch nicht geprüft';
function startAutoRefresh() {
  clearInterval(SYNC.timer); SYNC.timer = setInterval(() => { if (!document.hidden) refreshData(); }, 15 * 60 * 1000);
}

/* ---------- Einstellungen (Sheet) ---------- */
function openSettings() {
  const d = $('#dlg'), D = App.data, P = D?.profile || {};
  d.innerHTML = `<div class="sheet-head"><span></span><h2>Daten</h2><button class="done" id="s-close">Fertig</button></div>
  <div class="sheet-body">
    <div class="group"><h3>Datenstand</h3>
      <p class="sub">${D ? `${D.acts.length} Aktivitäten, ${D.daily.length} Tage (bis ${fmtDate(D.asOf)}).${D.source ? ' Quelle: ' + esc(D.source) : ''}` : 'Noch keine Daten geladen.'}</p>
      <div><label class="btn primary">${sym('download')}Datei importieren<input id="imp" type="file" accept=".json,.csv,application/json,text/csv" hidden></label></div>
      <p class="help">JSON (garmin-data.json) oder Aktivitäten-CSV aus Garmin Connect.</p><div class="status" id="imp-msg" role="status"></div></div>
    <div class="group"><h3>Automatisch aktualisieren</h3>
      <p class="help">Die App prüft beim Öffnen, beim Zurückkehren und alle 15 Minuten, ob eine neuere Datei bereitliegt. Garmin selbst erlaubt Apps keinen direkten Zugriff – die Datei muss von einer Quelle kommen, die sie aktuell hält.</p>
      <label class="f">Daten-URL (optional)<input type="url" id="s-url" placeholder="https://…/garmin-data.json oder github:besitzer/repo/datei.json" value="${esc(App.prefs.syncUrl || '')}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="f">Zugriffstoken (nur für private Quellen)<input type="password" id="s-token" placeholder="GitHub-Token mit Lesezugriff" value="${esc(App.prefs.syncToken || '')}" autocomplete="off"></label>
      <div class="row"><button class="btn" id="s-check">${sym('refresh')}Jetzt prüfen</button></div>
      <div class="status" id="sync-status">${esc(syncText())}</div>
      <p class="help">Das Token bleibt nur auf diesem Gerät. Verwende ein Token mit ausschließlich Lesezugriff auf genau ein privates Repository. Ohne Daten-URL sucht die App nach <i>data/garmin-data.json</i> neben sich.</p></div>
    ${D ? `<div class="group"><h3>Profil</h3><div class="row"><label class="f">Max. Herzfrequenz<input type="number" id="s-hrmax" value="${P.hrMax}" min="120" max="230" inputmode="numeric"></label><label class="f">Schrittziel<input type="number" id="s-steps" value="${P.stepGoal}" min="1000" step="500" inputmode="numeric"></label></div></div>` : ''}
    <div class="group"><h3>Darstellung</h3><label class="f">Erscheinungsbild<select id="s-theme"><option value="auto">Automatisch (wie das Gerät)</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></div>
    <div class="group"><h3>Verwalten</h3><div class="row"><button class="btn gray" id="s-export" ${D ? '' : 'disabled'}>${sym('share')}Daten exportieren</button><button class="btn danger" id="s-reset" ${D ? '' : 'disabled'}>Alle Daten löschen</button></div>
      <p class="help">Alle Daten bleiben in diesem Browser. Auf einem anderen Gerät importierst du dieselbe Datei oder richtest dieselbe Daten-URL ein.</p></div>
  </div>`;
  $('#s-theme').value = App.prefs.theme || 'auto';
  $('#imp').addEventListener('change', e => e.target.files[0] && importFile(e.target.files[0]));
  $('#s-theme').addEventListener('change', e => { App.prefs.theme = e.target.value; savePrefs(); applyTheme(); render(); });
  $('#s-export')?.addEventListener('click', exportData);
  $('#s-reset')?.addEventListener('click', () => { if (confirm('Wirklich alle gespeicherten Daten in diesem Browser löschen?')) { try { localStorage.removeItem(KEY); } catch { } App.data = null; d.close(); render(); } });
  const saveSync = () => { App.prefs.syncUrl = $('#s-url').value.trim(); App.prefs.syncToken = $('#s-token').value.trim(); savePrefs(); };
  $('#s-url').addEventListener('change', saveSync); $('#s-token').addEventListener('change', saveSync);
  $('#s-check').addEventListener('click', async () => { saveSync(); $('#sync-status').textContent = 'Prüfe …'; await refreshData({ manual: true }); });
  const upd = () => { if (!D) return; P.hrMax = +$('#s-hrmax').value || P.hrMax; P.stepGoal = +$('#s-steps').value || P.stepGoal; lsSet(KEY, rawFromState()); };
  $('#s-hrmax')?.addEventListener('change', () => { upd(); computeDerived(); render(); }); $('#s-steps')?.addEventListener('change', () => { upd(); render(); });
  $('#s-close').addEventListener('click', () => d.close());
  d.addEventListener('click', e => { if (e.target === d) d.close(); }, { once: true });
  d.showModal();
}
function applyTheme() { const t = App.prefs.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* ---------- Start ---------- */
async function boot() {
  applyTheme();
  $$('[data-sym]').forEach(el => { el.outerHTML = sym(el.dataset.sym); });
  $$('.nav [data-page]').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  $$('[data-open-settings]').forEach(b => b.addEventListener('click', openSettings));
  $('#btn-refresh').addEventListener('click', () => refreshData({ manual: true }));
  window.addEventListener('scroll', onScroll, { passive: true });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => App.data && render());
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!SYNC.last || Date.now() - SYNC.last > 5 * 60 * 1000)) refreshData(); });
  const stored = lsGet(KEY, null);
  if (stored) { try { setData(stored, false); } catch (e) { console.warn(e); } }
  render();
  await refreshData();          // beim Start: Quelle prüfen und ggf. aktualisieren
  startAutoRefresh();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
