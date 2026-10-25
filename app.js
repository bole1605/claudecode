'use strict';
/* Liegestütz Tracker – reine Client-App, Daten liegen lokal im Browser (localStorage). */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WD = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const KEY = { sessions: 'pushups.sessions', active: 'pushups.active', settings: 'pushups.settings' };

/* ---------- Storage ---------- */
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let sessions = load(KEY.sessions, []);
let settings = Object.assign({ sound: true, wake: true, goal: 20 }, load(KEY.settings, {}));
let active = Object.assign({ reps: 0, acc: 0, runStart: null }, load(KEY.active, {}));

/* ---------- Helpers ---------- */
const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtTime = s => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const fmtNum = (n, dec = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mondayOf = d => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function totalsByDay() {
  const m = new Map();
  for (const s of sessions) m.set(s.date, (m.get(s.date) || 0) + s.reps);
  return m;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Navigation ---------- */
const TITLES = { train: 'Training', cal: 'Kalender', stats: 'Statistik' };
function showView(v) {
  $$('.view').forEach(e => e.classList.toggle('active', e.id === 'view-' + v));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $('#title').textContent = TITLES[v];
  $('main').scrollTop = 0;
  if (v === 'cal') renderCalendar();
  if (v === 'stats') renderStats();
  if (v === 'train') renderTodayTotal();
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

/* ---------- Training: Zähler & Stoppuhr ---------- */
let tick = null, audio = null, wakeLock = null;
const elapsedSec = () => (active.acc + (active.runStart ? Date.now() - active.runStart : 0)) / 1000;
const running = () => active.runStart !== null;
const persistActive = () => save(KEY.active, active);

function beep() {
  if (!settings.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 660; o.type = 'sine';
    g.gain.setValueAtTime(.15, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .09);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + .1);
  } catch {}
}
async function setWake(on) {
  try {
    if (on && settings.wake && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
}

function start() {
  if (running()) return;
  active.runStart = Date.now(); persistActive();
  tick = setInterval(renderTimer, 250);
  setWake(true); renderTrain();
}
function pause() {
  if (!running()) return;
  active.acc += Date.now() - active.runStart; active.runStart = null; persistActive();
  clearInterval(tick); tick = null; setWake(false); renderTrain();
}
function addRep(n = 1) {
  if (n > 0 && !running()) start();
  active.reps = Math.max(0, active.reps + n); persistActive();
  if (n > 0) { beep(); navigator.vibrate?.(15); }
  renderTrain();
}
function resetActive() {
  pause(); active = { reps: 0, acc: 0, runStart: null }; persistActive(); renderTrain();
}
function finish() {
  if (active.reps === 0) return toast('Noch keine Wiederholungen gezählt');
  pause();
  const now = new Date();
  sessions.push({ id: now.getTime(), date: dateKey(now), reps: active.reps, dur: Math.round(active.acc / 1000) });
  save(KEY.sessions, sessions);
  const r = active.reps;
  active = { reps: 0, acc: 0, runStart: null }; persistActive();
  renderTrain(); renderTodayTotal();
  toast(`✅ ${r} Liegestütze gespeichert`);
}

function renderTimer() {
  const s = elapsedSec();
  $('#timer').textContent = fmtTime(s);
  $('#pace').innerHTML = `${fmtNum(s > 5 ? active.reps / (s / 60) : 0, 1)}<small>/min</small>`;
}
function renderTodayTotal() {
  const saved = totalsByDay().get(dateKey(new Date())) || 0;
  $('#today-total').textContent = saved;
}
function renderTrain() {
  $('#count').textContent = active.reps;
  const p = Math.min(1, active.reps / settings.goal);
  $('#ring-fg').style.strokeDashoffset = 578 * (1 - p);
  $('#tap').classList.toggle('reached', active.reps >= settings.goal);
  $('#goal-val').textContent = settings.goal;
  const started = active.acc > 0 || running();
  $('#btn-pause').textContent = running() ? 'Pause' : started ? 'Weiter' : 'Start';
  $('#tap-hint').textContent = running() ? 'Tippen = +1' : started ? 'Pausiert' : 'Tippen zum Starten';
  renderTimer();
}

const tap = $('#tap');
tap.addEventListener('pointerdown', e => {
  e.preventDefault(); addRep(1);
  tap.classList.add('pop'); setTimeout(() => tap.classList.remove('pop'), 90);
});
tap.addEventListener('click', e => { if (e.detail === 0) addRep(1); }); // Tastatur
$('#btn-undo').addEventListener('click', () => addRep(-1));
$('#btn-pause').addEventListener('click', () => running() ? pause() : start());
$('#btn-finish').addEventListener('click', finish);
$('#btn-reset').addEventListener('click', () => {
  if (active.reps === 0 && active.acc === 0 && !running()) return;
  if (confirm('Aktuelles Training verwerfen?')) resetActive();
});
$('#goal-plus').addEventListener('click', () => { settings.goal = Math.min(500, settings.goal + 5); save(KEY.settings, settings); renderTrain(); });
$('#goal-minus').addEventListener('click', () => { settings.goal = Math.max(5, settings.goal - 5); save(KEY.settings, settings); renderTrain(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && running()) setWake(true); });

/* ---------- Kalender ---------- */
let calMonth = new Date(); calMonth.setDate(1);
let selDay = dateKey(new Date());
$('#cal-weekdays').innerHTML = WD.map(d => `<span>${d}</span>`).join('');
$('#cal-prev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
$('#cal-next').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });

function renderCalendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('#cal-title').textContent = `${MONTHS[m]} ${y}`;
  const totals = totalsByDay();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const monthVals = [];
  for (let d = 1; d <= days; d++) { const v = totals.get(`${y}-${pad(m + 1)}-${pad(d)}`); if (v) monthVals.push(v); }
  const max = Math.max(1, ...monthVals);
  const today = dateKey(new Date());
  let html = '<span class="day empty"></span>'.repeat(lead);
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`, v = totals.get(k) || 0;
    const lvl = v ? Math.min(4, Math.ceil(v / max * 4)) : 0;
    html += `<button class="day ${lvl ? 'l' + lvl : ''} ${k === today ? 'today' : ''} ${k === selDay ? 'sel' : ''}" data-k="${k}">${d}${v ? `<small>${v}</small>` : ''}</button>`;
  }
  $('#cal-grid').innerHTML = html;
  $$('#cal-grid .day[data-k]').forEach(b => b.addEventListener('click', () => { selDay = b.dataset.k; renderCalendar(); }));

  const inMonth = sessions.filter(s => s.date.startsWith(`${y}-${pad(m + 1)}-`));
  const reps = inMonth.reduce((a, s) => a + s.reps, 0);
  $('#month-summary').innerHTML =
    `<div><b>${monthVals.length}</b>Trainingstage</div><div><b>${fmtNum(reps)}</b>Liegestütze</div><div><b>${inMonth.length}</b>Einheiten</div>`;
  renderDayDetail();
}
function renderDayDetail() {
  const list = sessions.filter(s => s.date === selDay).sort((a, b) => a.id - b.id);
  const d = parseKey(selDay);
  const title = d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  let body;
  if (!list.length) body = '<div class="muted">Kein Training an diesem Tag.</div>';
  else {
    const sum = list.reduce((a, s) => a + s.reps, 0);
    body = list.map(s => `<div class="session"><div><div class="reps">${s.reps} <span class="muted" style="font-size:14px;font-weight:600">Wdh.</span></div>
      <div class="meta">${new Date(s.id).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · ${fmtTime(s.dur)} min · ${fmtNum(s.dur ? s.reps / (s.dur / 60) : 0, 1)}/min</div></div>
      <button data-del="${s.id}">Löschen</button></div>`).join('') +
      (list.length > 1 ? `<div class="meta muted" style="padding-top:8px">Summe: <b style="color:var(--text)">${sum}</b></div>` : '');
  }
  $('#day-detail').innerHTML = `<h3 style="margin-bottom:8px">${esc(title)}</h3>${body}`;
  $$('#day-detail [data-del]').forEach(b => b.addEventListener('click', () => {
    if (!confirm('Diese Einheit löschen?')) return;
    sessions = sessions.filter(s => s.id !== Number(b.dataset.del));
    save(KEY.sessions, sessions); renderCalendar();
  }));
}

/* ---------- Diagramme (reines SVG) ---------- */
function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
/** pts: [{label, value, tip, avg?}]; type: 'bar' | 'line' */
function drawChart(el, pts, { type = 'bar', tickEvery = 5 } = {}) {
  if (!pts.length || pts.every(p => !p.value)) { el.innerHTML = '<div class="empty-note">Noch keine Daten – starte dein erstes Training! 💪</div>'; return; }
  const W = 600, H = 230, L = 34, R = 8, T = 12, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(...pts.map(p => Math.max(p.value, p.avg || 0))));
  const step = iw / pts.length, X = i => L + step * (i + .5), Y = v => T + ih - v / max * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img"><defs>
    <linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#ff3d71"/></linearGradient></defs>`;
  for (let i = 0; i <= 4; i++) {
    const v = max / 4 * i, y = Y(v);
    s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${y + 4}" text-anchor="end">${Math.round(v)}</text>`;
  }
  pts.forEach((p, i) => {
    if (i % tickEvery === 0 || i === pts.length - 1 && tickEvery === 1)
      s += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle">${esc(p.label)}</text>`;
  });
  if (type === 'bar') {
    const bw = Math.max(3, step * .68);
    pts.forEach((p, i) => {
      const h = p.value / max * ih;
      s += `<rect data-tip="${esc(p.tip)}" data-x="${X(i) / W}" data-y="${Y(p.value) / H}" x="${X(i) - bw / 2}" y="${T + ih - h}" width="${bw}" height="${Math.max(h, p.value ? 2 : 0)}" rx="${Math.min(5, bw / 2)}" fill="url(#gb)" opacity="${p.value ? 1 : 0}"/>
        <rect data-tip="${esc(p.tip)}" data-x="${X(i) / W}" data-y="${Y(p.value) / H}" x="${X(i) - step / 2}" y="${T}" width="${step}" height="${ih}" fill="transparent"/>`;
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.avg).toFixed(1)}`).join('');
    s += `<path d="${line}" fill="none" stroke="#7fd6ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join('');
    s += `<path d="${line} L${X(pts.length - 1)} ${T + ih} L${X(0)} ${T + ih}Z" fill="url(#gb)" opacity=".16"/>
      <path d="${line}" fill="none" stroke="url(#gb)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (pts.length > 1) { // lineare Trendlinie
      const n = pts.length, xs = pts.map((_, i) => i), my = pts.reduce((a, p) => a + p.value, 0) / n, mx = (n - 1) / 2;
      const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1;
      const k = xs.reduce((a, x, i) => a + (x - mx) * (pts[i].value - my), 0) / den, b = my - k * mx;
      s += `<line x1="${X(0)}" y1="${Y(Math.max(0, b))}" x2="${X(n - 1)}" y2="${Y(Math.max(0, b + k * (n - 1)))}" stroke="#7fd6ff" stroke-width="2.5" stroke-dasharray="6 6" stroke-linecap="round"/>`;
    }
    pts.forEach((p, i) => {
      s += `<circle data-tip="${esc(p.tip)}" data-x="${X(i) / W}" data-y="${Y(p.value) / H}" cx="${X(i)}" cy="${Y(p.value)}" r="${pts.length > 25 ? 4 : 5.5}" fill="#0b0f1a" stroke="#ff7a45" stroke-width="3"/>`;
    });
  }
  el.innerHTML = s + '</svg><div class="tip"></div>';
  const tip = $('.tip', el);
  const show = e => {
    const t = e.target.closest('[data-tip]'); if (!t) return;
    tip.textContent = t.dataset.tip;
    tip.style.left = (t.dataset.x * 100) + '%'; tip.style.top = (t.dataset.y * $('svg', el).clientHeight) + 'px';
    tip.style.opacity = 1;
  };
  el.addEventListener('pointerdown', show); el.addEventListener('pointermove', show);
  el.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
}

/* ---------- Statistik ---------- */
let range = 'days';
$$('#range-seg button').forEach(b => b.addEventListener('click', () => {
  range = b.dataset.r; $$('#range-seg button').forEach(x => x.classList.toggle('on', x === b)); renderStats();
}));

function movingAvg(vals, w) {
  return vals.map((_, i) => { const sl = vals.slice(Math.max(0, i - w + 1), i + 1); return sl.reduce((a, b) => a + b, 0) / sl.length; });
}
function buildSeries() {
  const totals = totalsByDay(), today = new Date();
  const pts = [];
  if (range === 'days') {
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i), v = totals.get(dateKey(d)) || 0;
      pts.push({ label: `${d.getDate()}.${d.getMonth() + 1}.`, value: v, tip: `${d.getDate()}.${d.getMonth() + 1}.: ${v}` });
    }
    const avg = movingAvg(pts.map(p => p.value), 7); pts.forEach((p, i) => p.avg = avg[i]);
    return { pts, tickEvery: 5 };
  }
  if (range === 'weeks') {
    const m0 = mondayOf(today);
    for (let i = 11; i >= 0; i--) {
      const a = addDays(m0, -7 * i); let v = 0;
      for (let j = 0; j < 7; j++) v += totals.get(dateKey(addDays(a, j))) || 0;
      pts.push({ label: `${a.getDate()}.${a.getMonth() + 1}.`, value: v, tip: `Woche ab ${a.getDate()}.${a.getMonth() + 1}.: ${v}` });
    }
    const avg = movingAvg(pts.map(p => p.value), 3); pts.forEach((p, i) => p.avg = avg[i]);
    return { pts, tickEvery: 2 };
  }
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1), pre = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-`;
    let v = 0; for (const [k, n] of totals) if (k.startsWith(pre)) v += n;
    pts.push({ label: MONTHS[d.getMonth()].slice(0, 3), value: v, tip: `${MONTHS[d.getMonth()]} ${d.getFullYear()}: ${v}` });
  }
  const avg = movingAvg(pts.map(p => p.value), 3); pts.forEach((p, i) => p.avg = avg[i]);
  return { pts, tickEvery: 2 };
}

function streaks(totals) {
  let cur = 0, d = new Date();
  if (!totals.has(dateKey(d))) d = addDays(d, -1);
  while (totals.has(dateKey(d))) { cur++; d = addDays(d, -1); }
  const keys = [...totals.keys()].sort(); let best = 0, run = 0, prev = null;
  for (const k of keys) {
    run = prev && dateKey(addDays(parseKey(prev), 1)) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = k;
  }
  return { cur, best };
}
function sumRange(totals, from, days) {
  let v = 0; for (let i = 0; i < days; i++) v += totals.get(dateKey(addDays(from, i))) || 0; return v;
}

function renderStats() {
  const totals = totalsByDay(), today = new Date();
  const total = sessions.reduce((a, s) => a + s.reps, 0);
  const best = sessions.reduce((a, s) => Math.max(a, s.reps), 0);
  const { cur, best: bestStreak } = streaks(totals);
  const w0 = sumRange(totals, addDays(today, -6), 7), w1 = sumRange(totals, addDays(today, -13), 7);
  const delta = w1 ? Math.round((w0 - w1) / w1 * 100) : null;
  const deltaHtml = delta === null ? '' : `<div class="d ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)} % ggü. Vorwoche</div>`;
  $('#kpis').innerHTML = [
    [fmtNum(total), 'Liegestütze gesamt', ''],
    [fmtNum(w0), 'Letzte 7 Tage', deltaHtml],
    [best, 'Bestleistung je Einheit', ''],
    [`${cur} 🔥`, 'Aktuelle Serie (Tage)', `<div class="d muted">Rekord: ${bestStreak}</div>`],
  ].map(([v, l, d]) => `<div class="kpi"><div class="v">${v}</div><div class="l">${l}</div>${d}</div>`).join('');

  const { pts, tickEvery } = buildSeries();
  drawChart($('#chart-main'), pts, { type: 'bar', tickEvery });

  const last = [...sessions].sort((a, b) => a.id - b.id).slice(-20).map((s, i) => {
    const d = parseKey(s.date);
    return { label: `${d.getDate()}.${d.getMonth() + 1}.`, value: s.reps, tip: `${d.getDate()}.${d.getMonth() + 1}.: ${s.reps} Wdh.` };
  });
  drawChart($('#chart-sessions'), last, { type: 'line', tickEvery: Math.max(1, Math.ceil(last.length / 6)) });

  // Auswertung in Worten
  let txt;
  if (sessions.length < 2) txt = 'Sammle ein paar Einheiten – dann erscheint hier deine Auswertung.';
  else {
    const sorted = [...sessions].sort((a, b) => a.id - b.id), h = Math.ceil(sorted.length / 2);
    const avgOf = a => a.reduce((x, s) => x + s.reps, 0) / a.length;
    const a1 = avgOf(sorted.slice(0, h)), a2 = avgOf(sorted.slice(h)), diff = a1 ? Math.round((a2 - a1) / a1 * 100) : 0;
    const dayCount = new Set(sessions.map(s => s.date)).size;
    const perDay = total / dayCount;
    txt = `<b>Ø ${fmtNum(avgOf(sorted), 1)} Wdh.</b> pro Einheit, <b>${fmtNum(perDay, 1)}</b> pro Trainingstag. ` +
      (diff > 0 ? `Die zweite Hälfte deiner Einheiten liegt <b class="up">${diff} % über</b> der ersten – starker Fortschritt! 🚀`
        : diff < 0 ? `Zuletzt lagst du <b class="down">${Math.abs(diff)} %</b> unter deinem früheren Schnitt – bleib dran, Pausen gehören dazu.`
          : 'Deine Leistung ist stabil. Zeit, das Ziel etwas anzuheben?');
  }
  $('#insight').innerHTML = `<h3 style="margin-bottom:6px">Auswertung</h3><div>${txt}</div>`;
}

/* ---------- Einstellungen & Daten ---------- */
const dlg = $('#dlg-settings');
$('#btn-settings').addEventListener('click', () => {
  $('#opt-sound').checked = settings.sound; $('#opt-wake').checked = settings.wake; dlg.showModal();
});
$('#opt-sound').addEventListener('change', e => { settings.sound = e.target.checked; save(KEY.settings, settings); });
$('#opt-wake').addEventListener('change', e => { settings.wake = e.target.checked; save(KEY.settings, settings); if (!settings.wake) setWake(false); });
$('#btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, sessions }, null, 2)], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `liegestuetze-${dateKey(new Date())}.json` });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#btn-import').addEventListener('click', () => $('#file-import').click());
$('#file-import').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const ok = (data.sessions || []).filter(s => s && /^\d{4}-\d\d-\d\d$/.test(s.date) && Number.isFinite(+s.reps));
    const ids = new Set(sessions.map(s => s.id)); let n = 0;
    for (const s of ok) if (!ids.has(s.id)) { sessions.push({ id: +s.id || Date.now() + n, date: s.date, reps: +s.reps, dur: +s.dur || 0 }); n++; }
    save(KEY.sessions, sessions); renderTodayTotal(); toast(`${n} Einheiten importiert`);
  } catch { toast('Datei konnte nicht gelesen werden'); }
  e.target.value = '';
});
$('#btn-wipe').addEventListener('click', () => {
  if (confirm('Wirklich ALLE gespeicherten Trainingsdaten löschen?')) {
    sessions = []; save(KEY.sessions, sessions); renderTodayTotal(); toast('Alle Daten gelöscht');
  }
});

/* ---------- Start ---------- */
if (running()) tick = setInterval(renderTimer, 250);
renderTrain(); renderTodayTotal();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
