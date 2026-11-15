/* Kern: Datenhaltung, Hilfsfunktionen, Analyse, Prognose, Trainingsplan */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = a => a.reduce((x, y) => x + y, 0);
const avg = a => { const v = a.filter(x => x != null && !isNaN(x)); return v.length ? sum(v) / v.length : null; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Datum ---------- */
const DAY = 864e5;
const pd = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const ds = d => d.toISOString().slice(0, 10);
const addDays = (s, n) => ds(new Date(pd(s).getTime() + n * DAY));
const diffDays = (a, b) => Math.round((pd(a) - pd(b)) / DAY);
const weekStart = s => { const d = pd(s); const wd = (d.getUTCDay() + 6) % 7; return ds(new Date(d.getTime() - wd * DAY)); };
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const wdOf = s => pd(s).getUTCDay();
const fmtDate = s => { const d = pd(s); return `${d.getUTCDate()}. ${MON[d.getUTCMonth()]}`; };
const fmtDateL = s => `${WD[wdOf(s)]}, ${fmtDate(s)}`;
const shortDate = s => `${pd(s).getUTCDate()}.${pd(s).getUTCMonth() + 1}.`;
const realToday = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; };

/* ---------- Formate ---------- */
const nf = (v, d = 0) => v == null || isNaN(v) ? '–' : Number(v).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtKm = m => nf(m / 1000, 1);
const fmtDur = sec => { if (sec == null) return '–'; const m = Math.round(sec / 60); const h = Math.floor(m / 60); return h ? `${h}:${String(m % 60).padStart(2, '0')} h` : `${m} min`; };
const fmtHM = sec => { const s = Math.round(sec); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; };
const fmtPace = spk => { if (!spk || !isFinite(spk)) return '–'; const m = Math.floor(spk / 60), s = Math.round(spk % 60); return s === 60 ? `${m + 1}:00` : `${m}:${String(s).padStart(2, '0')}`; };

/* ---------- Sportarten ---------- */
const SPORTS = {
  run: { label: 'Laufen', group: 'Laufen', icon: '🏃' },
  road: { label: 'Rennrad', group: 'Rad', icon: '🚴' },
  mtb: { label: 'Mountainbike', group: 'Rad', icon: '🚵' },
  gravel: { label: 'Gravelbike', group: 'Rad', icon: '🚴' },
  walk: { label: 'Gehen', group: 'Andere', icon: '🚶' },
  str: { label: 'Kraft', group: 'Andere', icon: '🏋️' },
  other: { label: 'Sonstiges', group: 'Andere', icon: '⚡' }
};
function sportOf(type) {
  const t = (type || '').toLowerCase();
  if (/run|jog|lauf/.test(t)) return 'run';
  if (/mountain|mtb/.test(t)) return 'mtb';
  if (/gravel/.test(t)) return 'gravel';
  if (/cycl|bik|road|rad/.test(t)) return 'road';
  if (/walk|hik|geh|wander/.test(t)) return 'walk';
  if (/strength|kraft|gym/.test(t)) return 'str';
  return 'other';
}

/* ---------- Datenspeicher ---------- */
const KEY = 'gd.data.v1', PREF = 'gd.prefs.v1', ROUTES = 'gd.routes.v1';
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

function expandRows(cols, rows) { return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]]))); }

/** Normalisiert Rohdaten (kompakt oder ausgeschrieben) in das interne Modell */
function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige JSON-Datei');
  const acts = (raw.actCols ? expandRows(raw.actCols, raw.activities || []) : (raw.activities || []))
    .filter(a => a && a.t).map(a => ({
      t: a.t, date: a.t.slice(0, 10), type: a.type, sport: sportOf(a.type), name: a.name || '',
      dist: +a.dist || 0, dur: +a.dur || 0, hr: a.hr ?? null, hrMax: a.hrMax ?? null, kcal: a.kcal ?? null, elev: +a.elev || 0
    })).sort((a, b) => a.t < b.t ? -1 : 1);
  const daily = (raw.dailyCols ? expandRows(raw.dailyCols, raw.daily || []) : (raw.daily || []))
    .filter(d => d && d.d).sort((a, b) => a.d < b.d ? -1 : 1);
  if (!acts.length && !daily.length) throw new Error('Weder Aktivitäten noch Tagesdaten gefunden');
  const profile = Object.assign({ name: '', hrMax: 190, lthr: 170, zones: [100, 118, 135, 154, 174], stepGoal: 10000 }, raw.profile || {});
  const asOf = [raw.today?.date, daily.at(-1)?.d, acts.at(-1)?.date].filter(Boolean).sort().at(-1);
  return { profile, acts, daily, today: raw.today || null, pred: raw.predictions || null, asOf, generated: raw.generated || null, source: raw.source || '' };
}

const App = { data: null, prefs: Object.assign({ goal: 'hm', days: 4, focus: 'mix' }, lsGet(PREF, {})) };
const savePrefs = () => lsSet(PREF, App.prefs);

function setData(raw, persist = true) {
  App.data = normalize(raw);
  if (persist && !lsSet(KEY, raw)) console.warn('Speichern im Browser nicht möglich');
  computeDerived();
}

function computeDerived() {
  const D = App.data;
  D.dayMap = Object.fromEntries(D.daily.map(d => [d.d, d]));
  calibrateLoad();
}

/* ---------- Trainingslast (geschätzt, an Garmin-Werten kalibriert) ---------- */
function rawLoad(a) {
  const P = App.data.profile;
  let hr = a.hr;
  if (hr == null) hr = { run: 0.88, mtb: 0.74, gravel: 0.70, road: 0.68, walk: 0.5, str: 0.55, other: 0.6 }[a.sport] * P.hrMax;
  const f = clamp((hr - 90) / (P.hrMax - 90), 0, 1.1);
  return (a.dur / 60) * Math.pow(f, 2) * 60;
}
function calibrateLoad() {
  const D = App.data;
  const by = {};
  D.acts.forEach(a => { by[a.date] = (by[a.date] || 0) + rawLoad(a); });
  D.rawByDay = by;
  const days = D.daily.map(d => d.d);
  let sA = 0, sR = 0;
  D.daily.forEach(d => {
    if (d.atl == null) return;
    const first = D.daily[0].d;
    if (diffDays(d.d, first) < 6) return;
    let r = 0; for (let i = 0; i < 7; i++) r += by[addDays(d.d, -i)] || 0;
    sA += d.atl; sR += r;
  });
  D.loadK = sR > 0 ? sA / sR : 1;
  if (!days.length) D.loadK = 1;
}
const loadOf = (date, D = App.data) => (D.rawByDay[date] || 0) * D.loadK;

/* ---------- Auswertungen ---------- */
function actsBetween(a, b) { return App.data.acts.filter(x => x.date >= a && x.date <= b); }
function summarize(list) {
  const r = { n: list.length, dist: 0, dur: 0, elev: 0, kcal: 0, run: 0, runDur: 0, bike: 0, bikeDur: 0 };
  list.forEach(a => {
    r.dist += a.dist; r.dur += a.dur; r.elev += a.elev; r.kcal += a.kcal || 0;
    if (a.sport === 'run') { r.run += a.dist; r.runDur += a.dur; }
    if (SPORTS[a.sport].group === 'Rad') { r.bike += a.dist; r.bikeDur += a.dur; }
  });
  return r;
}
function weekly(from, to) {
  const out = [];
  for (let w = weekStart(from); w <= to; w = addDays(w, 7)) {
    const list = actsBetween(w, addDays(w, 6));
    const g = { Laufen: 0, Rad: 0, Andere: 0 }, km = { Laufen: 0, Rad: 0, Andere: 0 };
    list.forEach(a => { const k = SPORTS[a.sport].group; g[k] += a.dur / 3600; km[k] += a.dist / 1000; });
    out.push({ w, g, km, n: list.length, elev: sum(list.map(a => a.elev)) });
  }
  return out;
}
const paceOf = a => a.dist > 100 ? a.dur / (a.dist / 1000) : null;
const speedOf = a => a.dur > 0 ? a.dist / a.dur * 3.6 : null;

function zoneOf(hr) {
  return Math.max(1, App.data.profile.zones.filter(f => hr >= f).length);
}
function zoneDistribution(list) {
  const t = [0, 0, 0, 0, 0]; let known = 0;
  list.forEach(a => { if (a.hr != null && a.dur > 0 && a.sport !== 'walk') { t[zoneOf(a.hr) - 1] += a.dur; known += a.dur; } });
  return { t, known };
}

function movingAvg(vals, n) {
  return vals.map((_, i) => { const s = vals.slice(Math.max(0, i - n + 1), i + 1).filter(v => v != null); return s.length >= Math.min(n, 3) || (i < n && s.length) ? avg(s) : null; });
}
function linreg(ys) {
  const pts = ys.map((y, x) => [x, y]).filter(p => p[1] != null);
  const n = pts.length; if (n < 3) return null;
  const mx = avg(pts.map(p => p[0])), my = avg(pts.map(p => p[1]));
  let nu = 0, de = 0; pts.forEach(([x, y]) => { nu += (x - mx) * (y - my); de += (x - mx) ** 2; });
  const m = de ? nu / de : 0; return { m, b: my - m * mx, n };
}
/** Lineare Prognose der letzten `win` Werte für `ahead` Tage */
function forecast(vals, win, ahead) {
  const tail = vals.slice(-win); const r = linreg(tail); if (!r) return null;
  const out = []; for (let i = 1; i <= ahead; i++) out.push(r.b + r.m * (tail.length - 1 + i));
  return { values: out, slopePerDay: r.m, last: r.b + r.m * (tail.length - 1) };
}

/* ---------- Bereitschaft & Tagesempfehlung ---------- */
function recoveryState() {
  const D = App.data, dl = D.daily; if (!dl.length) return null;
  const last = dl.at(-1);
  const base = dl.slice(-29, -1);
  const hrvBase = avg(base.map(d => d.hrv)), rhrBase = avg(base.map(d => d.rhr));
  const l3 = dl.slice(-3);
  const hrv3 = avg(l3.map(d => d.hrv)), rhr3 = avg(l3.map(d => d.rhr));
  const sleep2 = avg(dl.slice(-2).map(d => d.score));
  const acwr = last.acwr;
  let s = 70;
  if (hrv3 && hrvBase) s += clamp(hrv3 / hrvBase - 1, -0.4, 0.2) * 100;
  if (rhr3 && rhrBase) s -= clamp(rhr3 - rhrBase, -3, 8) * 2.5;
  if (sleep2) s += (sleep2 - 75) * 0.3;
  if (acwr) s -= Math.max(0, acwr - 1.3) * 25;
  const idx = Math.round(clamp(s, 0, 100));
  const R = D.today?.readiness || null;
  return { idx, hrv3, hrvBase, rhr3, rhrBase, sleep2, acwr, last, garmin: R, score: R ? R.score : idx };
}
const LEVEL_DE = { POOR: 'Niedrig', LOW: 'Niedrig', MODERATE: 'Mittel', FAIR: 'Mittel', HIGH: 'Hoch', GOOD: 'Hoch', PRIME: 'Sehr hoch' };
const FEEDBACK_DE = {
  TIME_TO_SLOW_DOWN: 'Zeit, einen Gang herunterzuschalten', RECOVERY_NEEDED: 'Erholung nötig', LIGHT_ACTIVITY: 'Nur leichte Aktivität empfohlen',
  READY_TO_GO: 'Bereit für Training', GOOD_FOR_HARD_WORKOUT: 'Gut für ein hartes Training', PRIME: 'Topform – nutze den Tag'
};
function tone(score) { return score >= 70 ? 'good' : score >= 45 ? 'warn' : 'bad'; }

function recommendToday() {
  const rs = recoveryState(); if (!rs) return null;
  const R = rs.garmin, sc = rs.score, acwr = rs.acwr || 0;
  const recH = R?.recoveryH || 0;
  const reasons = [];
  if (R) reasons.push(`Garmin-Bereitschaft ${R.score}/100${R.recoveryH ? `, Erholungszeit noch ca. ${nf(R.recoveryH, 0)} h` : ''}`);
  if (rs.hrv3 && rs.hrvBase) reasons.push(`HRV (3 Tage) ${nf(rs.hrv3)} ms vs. Basis ${nf(rs.hrvBase)} ms`);
  if (rs.rhr3 && rs.rhrBase) reasons.push(`Ruhepuls ${nf(rs.rhr3)} vs. Basis ${nf(rs.rhrBase)}`);
  if (acwr) reasons.push(`Belastungsverhältnis (ACWR) ${nf(acwr, 1)}`);
  let level, title, text;
  if (sc < 30 || recH >= 36) { level = 'rest'; title = 'Ruhetag oder aktive Erholung'; text = 'Körper und Last sprechen klar für Pause: lockerer Spaziergang (30–45 min, Puls unter 118) oder Mobility. Keine Intervalle, kein langer Lauf.'; }
  else if (sc < 50 || acwr > 1.5) { level = 'easy'; title = 'Nur locker – 30 bis 45 Minuten'; text = 'Lockerer Lauf oder entspanntes Radfahren im Grundlagenbereich (Zone 2, Puls 118–135). Wenn sich die Beine schwer anfühlen, abbrechen.'; }
  else if (sc < 70) { level = 'moderate'; title = 'Moderate Einheit möglich'; text = 'Grundlagenausdauer 45–75 min in Zone 2–3. Für harte Intervalle noch einen Tag warten.'; }
  else { level = 'hard'; title = 'Qualitätseinheit möglich'; text = 'Du bist erholt: Intervalle, Tempodauerlauf oder eine lange Tour sind heute gut verträglich.'; }
  return { level, title, text, reasons, state: rs };
}

/* ---------- Prognose der Belastung ---------- */
/** Verlauf Akutlast/Chronische Last über N Tage, Annahme: tägliche Last `plan[date]` (geschätzt, sonst 0).
 *  Garmin: Akutlast ≈ Summe der letzten 7 Tage, chronische Last ≈ Summe der letzten 28 Tage / 4. */
function projectLoad(ahead, plan) {
  const D = App.data, last = D.daily.at(-1); if (!last || last.atl == null) return null;
  let atl = last.atl, ctl = last.ctl; const out = [];
  for (let i = 1; i <= ahead; i++) {
    const day = addDays(last.d, i);
    const add = plan[day] || 0;
    const drop7 = loadOf(addDays(day, -7)) || (plan[addDays(day, -7)] || 0);
    const drop28 = loadOf(addDays(day, -28)) || (plan[addDays(day, -28)] || 0);
    atl = Math.max(0, atl + add - drop7);
    ctl = Math.max(0, ctl + (add - drop28) / 4);
    out.push({ d: day, atl, ctl, acwr: ctl > 0 ? atl / ctl : null });
  }
  return out;
}

/* ---------- Pace/Geschwindigkeit aus Historie ---------- */
function paceModel() {
  const D = App.data;
  const runs = D.acts.filter(a => a.sport === 'run' && a.dist >= 3000);
  const r28 = runs.filter(a => diffDays(D.asOf, a.date) <= 56);
  const pool = r28.length >= 3 ? r28 : runs;
  const avgPace = pool.length ? sum(pool.map(a => a.dur)) / (sum(pool.map(a => a.dist)) / 1000) : 330;
  let p10 = D.pred?.['10k'] ? D.pred['10k'] / 10 : avgPace * 0.97;
  const spd = sp => { const l = D.acts.filter(a => a.sport === sp && a.dist > 5000); return l.length ? sum(l.map(a => a.dist)) / sum(l.map(a => a.dur)) * 3.6 : { gravel: 22, mtb: 15, road: 26 }[sp]; };
  return { avgPace, p10, easy: [p10 * 1.27, p10 * 1.40], long: [p10 * 1.25, p10 * 1.36], tempo: [p10 * 1.05, p10 * 1.10], interval: [p10 * 0.93, p10 * 0.98], hm: D.pred?.hm ? D.pred.hm / 21.0975 : p10 * 1.08, speed: { gravel: spd('gravel'), mtb: spd('mtb'), road: spd('road') } };
}

/* ---------- Trainingsplan ---------- */
const GOALS = {
  fit: { label: 'Fit bleiben', growth: 0, qual: 1, peakLong: 0 },
  '10k': { label: '10 km schneller', growth: 0.06, qual: 2, peakLong: 16 },
  hm: { label: 'Halbmarathon', growth: 0.07, qual: 2, peakLong: 22 },
  m: { label: 'Marathon', growth: 0.07, qual: 2, peakLong: 32 },
  bike: { label: 'Rad-Ausdauer (Gravel/MTB)', growth: 0.06, qual: 1, peakLong: 0 }
};
const FOCUS = { run: 'Laufen', mix: 'Laufen + Rad', bike: 'Rad (MTB/Gravel)' };

function weeklyBaseline() {
  const D = App.data; const to = D.asOf;
  const span = Math.max(7, Math.min(56, diffDays(to, (D.daily[0]?.d || D.acts[0]?.date || to)) + 1));
  const l = actsBetween(addDays(to, -(span - 1)), to);
  const l4 = actsBetween(addDays(to, -27), to);
  const km = (list, w) => sum(list.filter(a => a.sport === 'run').map(a => a.dist)) / 1000 / w;
  const runKm4 = km(l4, Math.min(4, span / 7)), runKmAll = km(l, span / 7);
  // Wochenumfang: robust gegen kurze Pausen (längerer Schnitt zählt mit)
  const runKm = Math.max(runKm4, runKmAll * 0.85);
  const bikeH = sum(l.filter(a => SPORTS[a.sport].group === 'Rad').map(a => a.dur)) / 3600 / (span / 7);
  const longestRun = Math.max(0, ...l.filter(a => a.sport === 'run').map(a => a.dist / 1000));
  const longestBike = Math.max(0, ...l.filter(a => SPORTS[a.sport].group === 'Rad').map(a => a.dur / 60));
  return { runKm, runKm4, runKmAll, bikeH, longestRun, longestBike, span };
}

function buildPlan() {
  const D = App.data, P = App.prefs, G = GOALS[P.goal] || GOALS.fit, pm = paceModel(), base = weeklyBaseline(), rec = recommendToday();
  const Z = D.profile.zones, HM = D.profile.hrMax;
  const hr = { easy: `${Z[1]}–${Z[3] - 1} bpm`, tempo: `${Z[2]}–${Z[4] - 1} bpm`, int: `${Z[3]}–${HM} bpm`, z4: `${Z[3]}–${Z[4] - 1} bpm` };
  const runFocus = P.focus !== 'bike' && P.goal !== 'bike';
  const bikeFocus = P.focus !== 'run';
  let weekKm = Math.max(base.runKm, 12) * (1 + G.growth);
  if (rec && rec.level === 'rest') weekKm *= 0.92;
  weekKm = Math.round(weekKm);
  // Langer Lauf: orientiert am bisher längsten Lauf (+ leichte Steigerung), gedeckelt durch das Ziel
  const cap = G.peakLong || Math.max(12, base.longestRun);
  const longKm = clamp(Math.round(Math.min(Math.max(base.longestRun * (G.growth ? 1.05 : 0.95), weekKm * 0.32, 8), cap)), 6, 40);
  weekKm = Math.max(weekKm, Math.round(longKm * 2.2));
  const mk = (type, o) => Object.assign({ type }, o);
  const runEasy = km => mk('run-easy', { sport: 'run', title: 'Lockerer Dauerlauf', km, min: Math.round(km * (pm.easy[0] + pm.easy[1]) / 2 / 60), zone: 'Z2–Z3', hr: hr.easy, pace: `${fmtPace(pm.easy[0])}–${fmtPace(pm.easy[1])} /km`, desc: 'Gesprächstempo. Der Puls bleibt klar unter der Schwelle (181 bpm) – das ist die fehlende Grundlage.' });
  const runLong = km => mk('run-long', { sport: 'run', title: 'Langer Lauf', km, min: Math.round(km * (pm.long[0] + pm.long[1]) / 2 / 60), zone: 'Z2–Z3', hr: hr.easy, pace: `${fmtPace(pm.long[0])}–${fmtPace(pm.long[1])} /km`, desc: 'Gleichmäßig und ruhig. Die letzten 2 km dürfen etwas flotter werden.' });
  const runInt = () => { const reps = P.goal === '10k' ? 5 : 6, len = P.goal === 'm' ? 1.6 : 1.0; const km = Math.round(2.5 + 2 + reps * (len + 0.4)); return mk('run-int', { sport: 'run', title: `Intervalle ${reps} × ${len === 1 ? '1.000 m' : '1.600 m'}`, km, min: Math.round(km * 5.2), zone: 'Z4–Z5', hr: hr.int, pace: `${fmtPace(pm.interval[0])}–${fmtPace(pm.interval[1])} /km`, desc: `2,5 km einlaufen, ${reps} × ${len === 1 ? '1.000' : '1.600'} m zügig mit 400 m Trabpause, 2 km auslaufen.` }); };
  const runTempo = () => { const km = clamp(Math.round(weekKm * 0.22), 8, 16); return mk('run-tempo', { sport: 'run', title: 'Tempodauerlauf', km, min: Math.round(km * 5.2), zone: 'Z3–Z4', hr: hr.tempo, pace: `${fmtPace(pm.tempo[0])}–${fmtPace(pm.tempo[1])} /km`, desc: '2 km einlaufen, danach 20–30 min im Schwellentempo, 1 km auslaufen.' }); };
  const bikeEnd = (sport, min) => { const v = pm.speed[sport] || 20; return mk('bike-end', { sport, title: sport === 'gravel' ? 'Gravel-Grundlagentour' : sport === 'mtb' ? 'MTB-Tour mit Höhenmetern' : 'Rennrad-Grundlage', km: Math.round(v * min / 60), min, zone: 'Z2–Z3', hr: hr.easy, pace: `Ø ${nf(v, 0)} km/h`, desc: 'Gleichmäßig treten, Puls niedrig halten. Schiebt auch das Gesamtvolumen ohne Laufbelastung.' }); };
  const bikeInt = sport => mk('bike-int', { sport, title: 'Rad: Intervalle am Berg', km: Math.round((pm.speed[sport] || 20) * 75 / 60), min: 75, zone: 'Z4', hr: hr.z4, pace: '4 × 6 min am Berg', desc: '15 min einrollen, 4 × 6 min zügig bergauf (3 min Pause), locker ausrollen.' });
  const strength = () => mk('str', { sport: 'str', title: 'Kraft & Stabilität', km: 0, min: 35, zone: '–', hr: '–', pace: '', desc: 'Ganzkörper mit Fokus auf Beine, Rumpf und Hüfte: Kniebeugen, Ausfallschritte, Brücke, Plank. Beugt Laufverletzungen vor.' });
  const rest = () => mk('rest', { sport: null, title: 'Ruhetag', km: 0, min: 0, zone: '–', hr: '–', pace: '', desc: 'Pause oder 20–30 min Spaziergang / Mobility.' });
  const bikeSport = base.longestBike && D.acts.some(a => a.sport === 'gravel') && D.acts.filter(a => a.sport === 'gravel').length >= D.acts.filter(a => a.sport === 'mtb').length ? 'gravel' : 'mtb';
  const bikeMin = clamp(Math.round(Math.max(base.longestBike, 90) * 1.05 / 5) * 5, 75, (P.focus === 'bike' || P.goal === 'bike') ? 210 : 150);
  const n = clamp(P.days, 2, 6);

  // Wochenmuster (Mo=1 … So=0)
  const pat = {};
  const put = (wd, s) => { pat[wd] = s; };
  if (P.focus === 'run' || P.goal === 'm' && P.focus !== 'bike') {
    const eas = clamp(Math.round((weekKm - longKm - 10) / Math.max(1, n - 2)), 6, 14);
    put(2, runInt()); put(0, runLong(longKm));
    if (n >= 3) put(4, G.qual > 1 ? runTempo() : runEasy(eas));
    if (n >= 4) put(1, runEasy(eas));
    if (n >= 5) put(6, runEasy(Math.max(6, eas - 2)));
    if (n >= 6) put(3, strength());
  } else if (P.focus === 'bike' || P.goal === 'bike') {
    put(0, bikeEnd(bikeSport, bikeMin)); put(2, bikeInt(bikeSport));
    if (n >= 3) put(4, bikeEnd('road' === bikeSport ? 'gravel' : bikeSport, Math.round(bikeMin * 0.6)));
    if (n >= 4) put(6, runEasy(8));
    if (n >= 5) put(1, strength());
    if (n >= 6) put(3, runEasy(7));
  } else { // Mix
    const eas = clamp(Math.round((weekKm - longKm - 8) / Math.max(1, Math.min(n - 2, 2))), 7, 13);
    put(2, G.qual ? runInt() : runEasy(eas)); put(0, runLong(longKm));
    if (n >= 3) put(6, bikeEnd(bikeSport, bikeMin));
    if (n >= 4) put(4, runEasy(eas));
    if (n >= 5) put(1, bikeSport === 'mtb' ? bikeEnd('mtb', 75) : bikeEnd('gravel', 75));
    if (n >= 6) put(3, strength());
  }
  const start = D.asOf >= realToday() ? D.asOf : realToday();
  const days = []; let displaced = null;
  for (let i = 0; i < 7; i++) {
    const date = addDays(start, i); const wd = wdOf(date);
    let s = pat[wd] ? { ...pat[wd] } : rest();
    if (i === 0 && rec && (rec.level === 'rest' || rec.level === 'easy') && s.type !== 'rest' && s.type !== 'str') {
      displaced = { ...s };
      s = { ...s, original: s.title, type: 'swap', title: rec.level === 'rest' ? 'Ruhetag (Erholung geht vor)' : 'Locker statt ' + s.title, km: rec.level === 'rest' ? 0 : Math.min(s.km || 6, 6), min: rec.level === 'rest' ? 0 : Math.min(s.min || 35, 40), zone: 'Z1–Z2', hr: `unter ${Z[2]} bpm`, pace: '', desc: rec.level === 'rest' ? 'Heute aktive Erholung: Spaziergang oder Mobility. Die geplante Einheit rückt nach hinten.' : 'Heute nur locker, damit sich HRV und Ruhepuls erholen können.' };
      if (rec.level === 'rest') { s.sport = null; }
    }
    s.date = date; days.push(s);
  }
  // Verschobene Einheit auf einen späteren Ruhetag legen, der nicht an eine harte Einheit grenzt
  if (displaced) {
    const hard = t => ['run-int', 'run-long', 'run-tempo', 'bike-int'].includes(t);
    const j = days.findIndex((d, k) => k >= 2 && d.type === 'rest' && !hard(days[k - 1]?.type) && !hard(days[k + 1]?.type));
    if (j > 0) days[j] = { ...displaced, title: displaced.title + ' (verschoben)', date: days[j].date };
  }
  // geschätzte Last pro geplantem Tag (für Prognose)
  const factor = { 'run-easy': 0.22, 'run-long': 0.26, 'run-int': 0.5, 'run-tempo': 0.46, 'bike-end': 0.2, 'bike-int': 0.38, str: 0.1, swap: 0.12, rest: 0 };
  days.forEach(d => { d.load = d.min * (factor[d.type] ?? 0.1) * 60 * D.loadK; });
  const totalKm = sum(days.filter(d => d.sport === 'run').map(d => d.km));
  return { days, weekKm, totalKm, longKm, base, pm, goal: G, hr };
}
