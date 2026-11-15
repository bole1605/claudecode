/* Start, Navigation, Import/Export, Einstellungen */
'use strict';

const PAGES = { today: ['Heute', renderToday], review: ['Rückblick', renderReview], train: ['Training', renderTrain] };
App.page = (location.hash.slice(1) in PAGES) ? location.hash.slice(1) : 'today';
App.fcMode = 'plan'; App.range = '8w';

function render() {
  destroyCharts();
  const view = $('#view'); window.scrollTo({ top: 0 });
  $$('.nav [data-page]').forEach(b => b.dataset.page === App.page ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (!App.data) { view.innerHTML = emptyHtml(); bindEmpty(); return; }
  try { PAGES[App.page][1](view); } catch (e) { console.error(e); view.innerHTML = `<div class="banner warn"><b>Anzeigefehler:</b> ${esc(e.message)}</div>`; }
}
function go(p) { App.page = p; history.replaceState(null, '', '#' + p); render(); }

function emptyHtml() {
  return `<div class="empty"><h1>Willkommen 👋</h1><p>Noch keine Garmin-Daten geladen. Importiere die Datei <b>garmin-data.json</b> (von Claude erstellt) oder einen CSV-Export deiner Aktivitäten aus Garmin Connect.</p>
  <p><button class="btn primary" id="e-import">Daten importieren</button></p></div>`;
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

/* ---------- Einstellungen ---------- */
function openSettings() {
  const d = $('#dlg'), D = App.data, P = D?.profile || {};
  d.innerHTML = `<h2>Daten & Einstellungen</h2>
    <p class="sub">${D ? `Geladen: ${D.acts.length} Aktivitäten, ${D.daily.length} Tage (bis ${fmtDate(D.asOf)}).${D.source ? ' Quelle: ' + esc(D.source) : ''}` : 'Noch keine Daten.'}</p>
    <p><label class="btn primary" style="display:inline-block">Datei importieren<input id="imp" type="file" accept=".json,.csv,application/json,text/csv" hidden></label>
    <span class="sub"> JSON (garmin-data.json) oder Aktivitäten-CSV aus Garmin Connect</span></p>
    <div class="status" id="imp-msg" role="status"></div>
    ${D ? `<div class="row" style="margin:10px 0"><label class="f">Max. Herzfrequenz<input type="number" id="s-hrmax" value="${P.hrMax}" min="120" max="230"></label><label class="f">Schrittziel<input type="number" id="s-steps" value="${P.stepGoal}" min="1000" step="500"></label></div>` : ''}
    <div class="row" style="margin:10px 0"><label class="f">Darstellung<select id="s-theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></div>
    <div class="row" style="margin-top:14px"><button class="btn" id="s-export" ${D ? '' : 'disabled'}>Daten exportieren</button><button class="btn" id="s-reset" ${D ? '' : 'disabled'}>Alle Daten löschen</button><button class="btn" id="s-close" style="margin-left:auto">Schließen</button></div>
    <p class="help" style="margin-top:12px">Alle Daten bleiben in diesem Browser (lokal). Auf einem anderen Gerät importierst du dieselbe Datei erneut.</p>`;
  $('#s-theme').value = App.prefs.theme || 'auto';
  $('#imp').addEventListener('change', e => e.target.files[0] && importFile(e.target.files[0]));
  $('#s-theme').addEventListener('change', e => { App.prefs.theme = e.target.value; savePrefs(); applyTheme(); render(); });
  $('#s-export')?.addEventListener('click', exportData);
  $('#s-reset')?.addEventListener('click', () => { if (confirm('Wirklich alle gespeicherten Daten in diesem Browser löschen?')) { try { localStorage.removeItem(KEY); } catch { } App.data = null; d.close(); render(); } });
  const upd = () => { if (!D) return; P.hrMax = +$('#s-hrmax').value || P.hrMax; P.stepGoal = +$('#s-steps').value || P.stepGoal; const raw = rawFromState(); lsSet(KEY, raw); };
  $('#s-hrmax')?.addEventListener('change', () => { upd(); computeDerived(); render(); }); $('#s-steps')?.addEventListener('change', () => { upd(); render(); });
  $('#s-close').addEventListener('click', () => d.close());
  d.showModal();
}
function applyTheme() { const t = App.prefs.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

/* ---------- Start ---------- */
async function boot() {
  applyTheme();
  $$('.nav [data-page]').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
  $$('[data-open-settings]').forEach(b => b.addEventListener('click', openSettings));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => App.data && render());
  const stored = lsGet(KEY, null);
  let fileRaw = null;
  try { const r = await fetch('data/garmin-data.json', { cache: 'no-cache' }); if (r.ok) fileRaw = await r.json(); } catch { }
  const pick = fileRaw && (!stored || (fileRaw.generated || '') > (stored.generated || '')) ? fileRaw : stored;
  if (pick) { try { setData(pick, pick === fileRaw); } catch (e) { console.warn(e); } }
  render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
