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
let settings = Object.assign({ sound: true, haptic: true, wake: true, goal: 20 }, load(KEY.settings, {}));
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
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
function toast(msg) {
  const t = $('#toast'); $('span', t).textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* Haptik: Vibration (Android) bzw. Schalter-Trick für das Taptic Engine-Feedback in iOS-Safari */
const hapticLabel = Object.assign(document.createElement('label'), { className: 'haptic', innerHTML: '<input type="checkbox" switch tabindex="-1">' });
document.body.append(hapticLabel);
function haptic(ms = 10) {
  if (!settings.haptic) return;
  try { navigator.vibrate ? navigator.vibrate(ms) : hapticLabel.click(); } catch {}
}

/* Action Sheet (HIG: destruktive Aktionen immer bestätigen lassen) */
function actionSheet({ title, message, actions }) {
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-group">
    ${title || message ? `<div class="sheet-head">${title ? `<b>${esc(title)}</b>` : ''}${message ? `<span>${esc(message)}</span>` : ''}</div>` : ''}
    ${actions.map((a, i) => `<button class="sheet-btn ${a.danger ? 'danger' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}
    </div><button class="sheet-cancel">Abbrechen</button></div>`;
  const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 230); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') close(); };
  ov.addEventListener('click', e => {
    if (e.target === ov || e.target.closest('.sheet-cancel')) return close();
    const b = e.target.closest('[data-i]'); if (b) { close(); actions[b.dataset.i].fn(); }
  });
  document.addEventListener('keydown', esc_);
  document.body.append(ov); haptic(8);
}

/* ---------- Navigation ---------- */
const TITLES = { train: 'Training', cal: 'Kalender', stats: 'Statistik' };
function showView(v) {
  $$('.view').forEach(e => e.classList.toggle('active', e.id === 'view-' + v));
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $$('.tabbar button').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v));
  $('#title').textContent = $('#nav-title').textContent = TITLES[v];
  $('#main').scrollTop = 0; $('#navbar').classList.remove('scrolled');
  if (v === 'cal') renderCalendar();
  if (v === 'stats') renderStats();
  if (v === 'train') renderTodayTotal();
}
$$('.tabbar button').forEach(b => b.addEventListener('click', () => { haptic(6); showView(b.dataset.view); }));
$('#main').addEventListener('scroll', e => $('#navbar').classList.toggle('scrolled', e.target.scrollTop > 36), { passive: true });

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
  if (n > 0) { beep(); haptic(12); } else haptic(6);
  renderTrain();
  if (n > 0 && !reduceMotion.matches) $('#count').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
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
  haptic(20); toast(`${r} Liegestütze gespeichert`);
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
  $('#ring-fg').style.strokeDashoffset = 552.9 * (1 - p);
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
  actionSheet({ title: 'Training verwerfen?', message: 'Die bisher gezählten Wiederholungen werden nicht gespeichert.',
    actions: [{ label: 'Training verwerfen', danger: true, fn: resetActive }] });
});
$('#goal-plus').addEventListener('click', () => { haptic(6); settings.goal = Math.min(500, settings.goal + 5); save(KEY.settings, settings); renderTrain(); });
$('#goal-minus').addEventListener('click', () => { haptic(6); settings.goal = Math.max(5, settings.goal - 5); save(KEY.settings, settings); renderTrain(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && running()) setWake(true); });

/* ---------- Kalender ---------- */
let calMonth = new Date(); calMonth.setDate(1);
let selDay = dateKey(new Date());
$('#cal-weekdays').innerHTML = WD.map(d => `<span>${d}</span>`).join('');
function shiftMonth(n) {
  calMonth.setMonth(calMonth.getMonth() + n); haptic(6); renderCalendar();
  if (!reduceMotion.matches) $('#cal-grid').animate([{ opacity: 0, transform: `translateX(${n * 28}px)` }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.32,.72,0,1)' });
}
$('#cal-prev').addEventListener('click', () => shiftMonth(-1));
$('#cal-next').addEventListener('click', () => shiftMonth(1));

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
    html += `<button class="day ${lvl ? 'l' + lvl : ''} ${k === today ? 'today' : ''} ${k === selDay ? 'sel' : ''}" data-k="${k}" aria-label="${d}. ${MONTHS[m]}${v ? `, ${v} Liegestütze` : ''}"><span class="n">${d}</span>${v ? `<small>${v}</small>` : ''}</button>`;
  }
  $('#cal-grid').innerHTML = html;
  $$('#cal-grid .day[data-k]').forEach(b => b.addEventListener('click', () => { selDay = b.dataset.k; haptic(6); renderCalendar(); }));

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
  const sum = list.reduce((a, s) => a + s.reps, 0);
  const rows = list.length ? list.map(s => `<button class="row session" data-del="${s.id}" aria-label="Einheit mit ${s.reps} Wiederholungen, Optionen">
      <span><span class="reps">${s.reps} <small>Wdh.</small></span><br>
      <span class="meta">${new Date(s.id).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · ${fmtTime(s.dur)} min · ${fmtNum(s.dur ? s.reps / (s.dur / 60) : 0, 1)}/min</span></span>
      <svg class="ico"><use href="#i-more"/></svg></button>`).join('')
    : '<div class="empty-row">Kein Training an diesem Tag.</div>';
  $('#day-detail').innerHTML = `<h3 class="day-title">${esc(title)}</h3><div class="list">${rows}</div>` +
    (list.length > 1 ? `<p class="list-foot">Summe: <b style="color:var(--label)">${sum}</b> Wiederholungen</p>` : '');
  $$('#day-detail [data-del]').forEach(b => b.addEventListener('click', () => {
    const s = sessions.find(x => x.id === Number(b.dataset.del));
    actionSheet({ title: `${s.reps} Wiederholungen`, actions: [{ label: 'Einheit löschen', danger: true, fn: () => {
      sessions = sessions.filter(x => x.id !== s.id); save(KEY.sessions, sessions); renderCalendar(); renderTodayTotal();
    } }] });
  }));
}

/* ---------- Diagramme (reines SVG) ---------- */
function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
/** pts: [{label, value, tip, avg?}]; type: 'bar' | 'line' – Farben kommen aus CSS (System-Farben) */
function drawChart(el, pts, { type = 'bar', tickEvery = 5 } = {}) {
  el.classList.remove('has-sel');
  if (!pts.length || pts.every(p => !p.value)) {
    el.innerHTML = '<div class="empty-note"><svg class="ico"><use href="#i-chart"/></svg>Noch keine Daten – starte dein erstes Training.</div>'; return;
  }
  const W = 600, H = 230, L = 6, R = 30, T = 34, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(...pts.map(p => Math.max(p.value, p.avg || 0))));
  const step = iw / pts.length, X = i => L + step * (i + .5), Y = v => T + ih - v / max * ih;
  const total = pts.reduce((a, p) => a + p.value, 0);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagramm, Summe ${total} Wiederholungen, höchster Wert ${Math.max(...pts.map(p => p.value))}">`;
  for (let i = 0; i <= 4; i++) { // Y-Achse rechts, wie in Apple Charts
    const v = max / 4 * i, y = Y(v);
    s += `<line class="grid" x1="${L}" x2="${W - R + 4}" y1="${y}" y2="${y}"/><text x="${W - R + 8}" y="${y + 4}">${Math.round(v)}</text>`;
  }
  pts.forEach((p, i) => { if (i % tickEvery === 0) s += `<text x="${X(i)}" y="${H - 7}" text-anchor="middle">${esc(p.label)}</text>`; });
  s += `<line class="rule" id="rule" x1="0" x2="0" y1="${T}" y2="${T + ih}"/>`;
  if (type === 'bar') {
    const bw = Math.max(3, step * .66);
    pts.forEach((p, i) => {
      const h = p.value / max * ih;
      if (p.value) s += `<rect class="bar" data-i="${i}" x="${X(i) - bw / 2}" y="${T + ih - h}" width="${bw}" height="${Math.max(h, 2)}" rx="${Math.min(4, bw / 2)}"/>`;
    });
    s += `<path class="trend" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.avg).toFixed(1)}`).join('')}"/>`;
  } else {
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join('');
    s += `<path class="area" d="${line} L${X(pts.length - 1)} ${T + ih} L${X(0)} ${T + ih}Z"/><path class="lineacc" d="${line}"/>`;
    if (pts.length > 1) {
      const n = pts.length, my = total / n, mx = (n - 1) / 2;
      const den = pts.reduce((a, _, i) => a + (i - mx) ** 2, 0) || 1;
      const k = pts.reduce((a, p, i) => a + (i - mx) * (p.value - my), 0) / den, b = my - k * mx;
      s += `<line class="trend" stroke-dasharray="6 6" x1="${X(0)}" y1="${Y(Math.max(0, b))}" x2="${X(n - 1)}" y2="${Y(Math.max(0, b + k * (n - 1)))}"/>`;
    }
    pts.forEach((p, i) => { s += `<circle class="pt" data-i="${i}" cx="${X(i)}" cy="${Y(p.value)}" r="${pts.length > 25 ? 3.5 : 5}"/>`; });
  }
  el.innerHTML = s + '</svg><div class="tip"></div>';

  // Scrubbing: Finger über das Diagramm ziehen zeigt Werte (Rule Mark + Callout)
  const svg = $('svg', el), tip = $('.tip', el), rule = $('#rule', el);
  let hideT;
  const select = e => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(pts.length - 1, Math.floor(((e.clientX - r.left) / r.width * W - L) / step)));
    rule.setAttribute('x1', X(i)); rule.setAttribute('x2', X(i)); rule.style.opacity = 1;
    $$('.bar', el).forEach(b => b.classList.toggle('on', +b.dataset.i === i));
    el.classList.add('has-sel');
    tip.textContent = pts[i].tip;
    tip.style.left = Math.max(14, Math.min(86, X(i) / W * 100)) + '%';
    tip.classList.add('show'); clearTimeout(hideT);
    if (select.last !== i) { haptic(4); select.last = i; }
  };
  const hide = () => { hideT = setTimeout(() => { tip.classList.remove('show'); rule.style.opacity = 0; el.classList.remove('has-sel'); select.last = -1; }, 1400); };
  svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); select(e); });
  svg.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') select(e); });
  svg.addEventListener('pointerup', hide); svg.addEventListener('pointercancel', hide); svg.addEventListener('pointerleave', hide);
}

/* ---------- Statistik ---------- */
let range = 'days';
$$('#range-seg button').forEach(b => b.addEventListener('click', () => {
  range = b.dataset.r; haptic(6);
  $$('#range-seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#range-seg').style.setProperty('--i', $$('#range-seg button').indexOf(b)); renderStats();
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
  const deltaHtml = delta === null ? '' : `<div class="d ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '↑' : '↓'} ${Math.abs(delta)} % ggü. Vorwoche</div>`;
  $('#kpis').innerHTML = [
    [fmtNum(total), 'Gesamt', ''],
    [fmtNum(w0), 'Letzte 7 Tage', deltaHtml],
    [best, 'Bestleistung', ''],
    [cur, 'Serie in Tagen', `<div class="d muted">Rekord: ${bestStreak}</div>`],
  ].map(([v, l, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div>${d}</div>`).join('');

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
      (diff > 0 ? `Die zweite Hälfte deiner Einheiten liegt <b class="up">${diff} % über</b> der ersten – starker Fortschritt.`
        : diff < 0 ? `Zuletzt lagst du <b class="down">${Math.abs(diff)} %</b> unter deinem früheren Schnitt – bleib dran, Pausen gehören dazu.`
          : 'Deine Leistung ist stabil. Zeit, das Ziel etwas anzuheben?');
  }
  $('#insight').innerHTML = `<h3>Auswertung</h3><p>${txt}</p>`;
}

/* ---------- Einstellungen & Daten ---------- */
const dlg = $('#dlg-settings');
$('#btn-settings').addEventListener('click', () => {
  $('#opt-sound').checked = settings.sound; $('#opt-haptic').checked = settings.haptic; $('#opt-wake').checked = settings.wake; dlg.showModal();
});
$('#dlg-close').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
$('#opt-sound').addEventListener('change', e => { settings.sound = e.target.checked; save(KEY.settings, settings); haptic(8); });
$('#opt-haptic').addEventListener('change', e => { settings.haptic = e.target.checked; save(KEY.settings, settings); haptic(8); });
$('#opt-wake').addEventListener('change', e => { settings.wake = e.target.checked; save(KEY.settings, settings); haptic(8); if (!settings.wake) setWake(false); });
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
$('#btn-wipe').addEventListener('click', () => actionSheet({
  title: 'Alle Daten löschen?', message: 'Dies kann nicht rückgängig gemacht werden. Exportiere deine Daten vorher.',
  actions: [{ label: 'Alle Daten löschen', danger: true, fn: () => { sessions = []; save(KEY.sessions, sessions); renderTodayTotal(); renderCalendar(); toast('Alle Daten gelöscht'); } }]
}));

/* ---------- Start ---------- */
if (running()) tick = setInterval(renderTimer, 250);
renderTrain(); renderTodayTotal();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
