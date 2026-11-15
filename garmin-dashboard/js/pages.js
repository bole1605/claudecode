/* Seiten: Heute · Rückblick · Training */
'use strict';

const ICON = { sleep: '🌙', hrv: '💓', rhr: '❤️', bb: '🔋', stress: '🧠', steps: '👟', vo2: '🫁', load: '📈', rec: '⏳' };
const tile = (icon, label, value, unit, sub, extra = '') => `<div class="tile"><div class="l"><span aria-hidden="true">${icon}</span>${esc(label)}</div><div class="v">${value}${unit ? `<small>${unit}</small>` : ''}</div>${sub ? `<div class="d">${sub}</div>` : ''}${extra}</div>`;
const delta = (v, d = 0, unit = '', goodUp = true) => v == null ? '' : `<span class="${(v >= 0) === goodUp ? 'up' : 'down'}">${v >= 0 ? '▲' : '▼'} ${nf(Math.abs(v), d)}${unit}</span>`;
const dayLabels = (from, n) => Array.from({ length: n }, (_, i) => shortDate(addDays(from, i)));
const acwrState = a => a == null ? '' : a < 0.8 ? 'niedrig' : a <= 1.4 ? 'optimal' : 'hoch';

function actRow(a) {
  const S = SPORTS[a.sport]; const pace = a.sport === 'run' || a.sport === 'walk' ? (paceOf(a) ? `${fmtPace(paceOf(a))} /km` : '') : (a.dist > 1000 ? `${nf(speedOf(a), 1)} km/h` : '');
  const meta = [pace, a.hr ? `Ø ${a.hr} bpm` : '', a.elev > 5 ? `↑ ${nf(a.elev)} m` : ''].filter(Boolean).join(' · ');
  const main = a.dist > 300 ? `${fmtKm(a.dist)} km` : fmtDur(a.dur);
  return `<div class="act"><div class="ic" aria-hidden="true">${S.icon}</div><div class="t">${esc(S.label)}</div><div class="r">${main}</div><div class="m">${fmtDateL(a.date)}, ${a.t.slice(11, 16)} · ${meta}</div><div class="r2">${a.dist > 300 ? fmtDur(a.dur) : ''}</div></div>`;
}

/* ---------- Auswertungstexte aus den Daten ---------- */
function buildInsights() {
  const D = App.data, rs = recoveryState(), out = [];
  if (!rs) return out;
  if (rs.hrv3 && rs.hrvBase) { const d = rs.hrv3 - rs.hrvBase, p = d / rs.hrvBase * 100; if (p < -8) out.push({ tone: 'warn', text: `HRV (3 Tage) liegt ${nf(Math.abs(d))} ms (${nf(Math.abs(p))} %) unter deiner 4-Wochen-Basis – typisch bei aufgestauter Belastung oder zu wenig Erholung.` }); else if (p > 6) out.push({ tone: 'good', text: `HRV liegt ${nf(d)} ms über deiner Basis – gutes Erholungssignal.` }); }
  if (rs.rhr3 && rs.rhrBase && rs.rhr3 - rs.rhrBase >= 2) out.push({ tone: 'warn', text: `Ruhepuls ist mit Ø ${nf(rs.rhr3)} bpm etwa ${nf(rs.rhr3 - rs.rhrBase)} bpm höher als sonst (${nf(rs.rhrBase)}).` });
  const dl = D.daily; const l7 = dl.slice(-7); const sl = avg(l7.map(d => d.sleep));
  if (sl) { const short = l7.filter(d => d.sleep < 6.5).length; out.push({ tone: sl < 7 ? 'warn' : 'good', text: `Schlaf der letzten 7 Nächte: Ø ${nf(sl, 1)} h${short ? `, ${short}× unter 6,5 h` : ''}.` }); }
  const l28 = actsBetween(addDays(D.asOf, -27), D.asOf).filter(a => a.sport === 'run' && a.hr);
  const zd = zoneDistribution(l28); if (zd.known > 3600) { const hi = (zd.t[3] + zd.t[4]) / zd.known * 100; if (hi > 45) out.push({ tone: 'warn', text: `${nf(hi)} % deiner Laufzeit liegt in Zone 4–5 (Ø-HF ${nf(avg(l28.map(a => a.hr)))} bpm). Mehr lockere Läufe in Zone 2–3 bauen Grundlage auf und senken das Verletzungsrisiko.` }); }
  const w = weekly(addDays(D.asOf, -34), D.asOf); const cur = weekStart(D.asOf);
  const full = w.filter(x => x.w < cur); if (full.length >= 2) { const a = full.at(-1), b = full.at(-2); out.push({ tone: 'info', text: `Letzte volle Woche: ${nf(a.km.Laufen, 0)} km Laufen, ${nf(a.km.Rad, 0)} km Rad (Vorwoche ${nf(b.km.Laufen, 0)} / ${nf(b.km.Rad, 0)} km).` }); }
  const vo = dl.map(d => d.vo2).filter(v => v != null); if (vo.length > 20) { const ch = vo.at(-1) - vo.at(-28 >= -vo.length ? -28 : 0); if (Math.abs(ch) >= 0.5) out.push({ tone: ch < 0 ? 'warn' : 'good', text: `VO₂max ${ch < 0 ? 'sank' : 'stieg'} in 4 Wochen um ${nf(Math.abs(ch), 1)} auf ${nf(vo.at(-1), 1)}.` }); }
  return out;
}

/* ================= HEUTE ================= */
function renderToday(el) {
  const D = App.data, dl = D.daily, last = dl.at(-1) || {}, T = D.today || {}, rs = recoveryState(), rec = recommendToday(), R = rs?.garmin;
  const stale = diffDays(realToday(), D.asOf) >= 1;
  const sc = rec ? rec.state.score : null, tn = sc == null ? '' : 'tone-' + tone(sc);
  const circ = 2 * Math.PI * 56;
  const base = dl.slice(-29, -1);
  const hrvBase = avg(base.map(d => d.hrv)), hrv7 = avg(dl.slice(-7).map(d => d.hrv));
  const rhr = T.rhr ?? last.rhr, rhr7 = T.rhr7 ?? avg(dl.slice(-7).map(d => d.rhr));
  const vo = dl.map(d => d.vo2).filter(v => v != null);
  const steps = T.steps ?? last.steps, goal = D.profile.stepGoal;
  const todays = D.acts.filter(a => a.date === D.asOf);
  const recent = D.acts.slice(-6).reverse();
  const insights = buildInsights();
  if (!dl.length) { // nur Aktivitäten importiert (z. B. CSV) – keine Tageswerte
    el.innerHTML = `<div class="page-head"><div><h1>Heute</h1><div class="sub">Letzte Aktivität: ${D.acts.length ? fmtDateL(D.acts.at(-1).date) : '–'}</div></div></div>
      <div class="banner warn"><b>Es sind nur Aktivitäten geladen.</b> Schlaf, HRV, Ruhepuls und Schritte fehlen – dafür bitte <i>garmin-data.json</i> importieren (Daten → Datei importieren). Rückblick und Training funktionieren schon.</div>
      <section class="card"><div class="hd"><h2>Letzte Aktivitäten</h2></div><div class="acts">${recent.map(actRow).join('')}</div></section>`;
    return;
  }

  // Woche (Mo–So)
  const ws = weekStart(D.asOf); const wk = Array.from({ length: 7 }, (_, i) => { const d = addDays(ws, i); const l = D.acts.filter(a => a.date === d && a.dist + a.dur > 600); return { d, l }; });

  el.innerHTML = `
  <div class="page-head"><div><h1>Heute</h1><div class="sub">${WDL[wdOf(D.asOf)]}, ${fmtDate(D.asOf)} · Datenstand ${D.generated ? D.generated.slice(11, 16) + ' Uhr' : ''}</div></div></div>
  ${stale ? `<div class="banner warn"><b>Daten sind ${diffDays(realToday(), D.asOf)} Tag(e) alt.</b> Aktualisiere sie über „Daten“ (Import) oder bitte Claude, die Garmin-Daten neu abzurufen.</div>` : ''}
  <div class="grid">
    <section class="card c12" style="grid-column:span 12">
      <div class="hero">
        ${sc == null ? '' : `<div class="ring ${tn}" role="img" aria-label="Bereitschaft ${sc} von 100"><svg viewBox="0 0 132 132"><circle class="bg" cx="66" cy="66" r="56"/><circle cx="66" cy="66" r="56" stroke="var(--tone)" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - sc / 100)}"/></svg><div class="num"><div><b>${sc}</b><br><span>${R ? 'Bereitschaft' : 'Erholung'}</span></div></div></div>`}
        <div class="reco ${tn}">
          ${rec ? `<span class="badge">${R ? (LEVEL_DE[R.level] || R.level) + ' – ' + (FEEDBACK_DE[R.feedback] || '') : 'Empfehlung'}</span>
          <h3>${esc(rec.title)}</h3><p>${esc(rec.text)}</p>
          <ul class="reasons">${rec.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p>Zu wenig Daten für eine Empfehlung.</p>'}
        </div>
      </div>
    </section>
  </div>
  <div class="spacer"></div>
  <div class="tiles">
    ${tile(ICON.sleep, 'Schlaf', nf(last.sleep, 1), 'h', last.score != null ? `Score ${last.score} · Tief ${nf(last.deep)} · REM ${nf(last.rem)} min` : '', last.sleep ? `<div class="bar"><i style="width:${clamp(last.sleep / 9 * 100, 0, 100)}%"></i></div>` : '')}
    ${tile(ICON.hrv, 'HRV (Nacht)', nf(last.hrv), 'ms', hrvBase ? `7 Tage Ø ${nf(hrv7)} · Basis ${nf(hrvBase)} ${delta(hrv7 - hrvBase, 0, ' ms')}` : '')}
    ${tile(ICON.rhr, 'Ruhepuls', nf(rhr), 'bpm', rhr7 ? `7 Tage Ø ${nf(rhr7)} bpm` : '')}
    ${tile(ICON.bb, 'Body Battery', nf(T.bb), '', T.bbWake != null ? `Beim Aufwachen ${nf(T.bbWake)} · Hoch ${nf(T.bbHigh)}` : '', T.bb != null ? `<div class="bar"><i style="width:${clamp(T.bb, 0, 100)}%;background:var(--s3)"></i></div>` : '')}
    ${tile(ICON.stress, 'Stress (Ø)', nf(T.stress), '', T.stress != null ? (T.stress < 26 ? 'Ruhig' : T.stress < 51 ? 'Gering' : 'Erhöht') : '')}
    ${tile(ICON.steps, 'Schritte', nf(steps), '', `Ziel ${nf(goal)}`, `<div class="bar"><i style="width:${clamp(steps / goal * 100, 0, 100)}%;background:var(--s2)"></i></div>`)}
    ${tile(ICON.vo2, 'VO₂max', nf(last.vo2, 1), '', vo.length > 8 ? `${delta(vo.at(-1) - vo[Math.max(0, vo.length - 28)], 1)} in 4 Wochen` : '')}
    ${tile(ICON.load, 'Belastung (ACWR)', nf(last.acwr, 1), '', last.atl != null ? `Akut ${nf(last.atl)} · Chronisch ${nf(last.ctl)} · ${acwrState(last.acwr)}` : '')}
  </div>
  <div class="spacer"></div>
  <div class="grid">
    <section class="card c6"><div class="hd"><div><h2>Diese Woche</h2><div class="sub">${fmtDate(ws)} – ${fmtDate(addDays(ws, 6))}</div></div></div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;text-align:center">${wk.map(x => `<div style="background:var(--surface-2);border-radius:10px;padding:8px 2px;${x.d === D.asOf ? 'outline:2px solid var(--accent)' : ''}"><div class="sub">${WD[wdOf(x.d)]}</div><div style="font-size:18px;min-height:26px">${x.l.length ? [...new Set(x.l.map(a => SPORTS[a.sport].icon))].join('') : '<span class="muted">·</span>'}</div><div class="sub">${x.l.length ? nf(sum(x.l.map(a => a.dist)) / 1000, 0) + ' km' : ''}</div></div>`).join('')}</div>
      ${(() => { const s = summarize(actsBetween(ws, D.asOf)); return `<p class="note">${s.n} Einheit(en) · ${fmtDur(s.dur)} · Laufen ${fmtKm(s.run)} km · Rad ${fmtKm(s.bike)} km · ${nf(s.elev)} Höhenmeter</p>`; })()}
    </section>
    <section class="card c6"><div class="hd"><div><h2>${todays.length ? 'Aktivitäten heute' : 'Letzte Aktivitäten'}</h2></div></div><div class="acts">${(todays.length ? todays : recent).slice(0, 5).map(actRow).join('') || '<p class="sub">Noch keine Aktivität.</p>'}</div></section>
  </div>
  <div class="spacer"></div>
  <div class="page-head"><div><h1 style="font-size:20px">Trends & Prognose</h1><div class="sub">Gestrichelt = Vorhersage. Sie ist ein Modell, keine Garantie.</div></div>
    <div class="seg" role="group" aria-label="Annahme"><button data-fc="plan" aria-pressed="${App.fcMode !== 'rest'}">Mit Trainingsplan</button><button data-fc="rest" aria-pressed="${App.fcMode === 'rest'}">Nur Ruhe</button></div></div>
  <div class="grid">
    ${chartCard({ id: 'ch-load', title: 'Belastung: Akut- und Chronische Last', sub: 'Garmin-Werte, 7 Tage Vorschau', cls: 'c8', legend: [{ label: 'Akutlast', color: SERIES(1) }, { label: 'Chronische Last', color: SERIES(0) }, { label: 'Prognose', color: cv('--text-2'), dash: true }] })}
    <section class="card c4"><div class="hd"><h2>Auswertung</h2></div><div id="insights">${insights.map(i => `<p class="note" style="margin:0 0 10px">${i.tone === 'warn' ? '⚠️' : i.tone === 'good' ? '✅' : 'ℹ️'} ${esc(i.text)}</p>`).join('') || '<p class="sub">Keine Auffälligkeiten.</p>'}</div></section>
    ${chartCard({ id: 'ch-hrv', title: 'HRV – Verlauf & Trend', sub: 'Nächtlicher Wert, 7-Tage-Mittel, 10-Tage-Prognose', legend: [{ label: 'Nacht', color: SERIES(0) }, { label: '7-Tage-Ø', color: SERIES(1) }, { label: 'Prognose', color: cv('--text-2'), dash: true }], note: '' })}
    ${chartCard({ id: 'ch-rhr', title: 'Ruhepuls – Verlauf & Trend', sub: 'Nächtlicher Wert, 7-Tage-Mittel, 10-Tage-Prognose', legend: [{ label: 'Nacht', color: SERIES(0) }, { label: '7-Tage-Ø', color: SERIES(1) }, { label: 'Prognose', color: cv('--text-2'), dash: true }] })}
    ${chartCard({ id: 'ch-sleep14', title: 'Schlaf der letzten 14 Nächte', sub: 'Phasen in Stunden', legend: [{ label: 'Tief', color: SERIES(0) }, { label: 'REM', color: SERIES(1) }, { label: 'Leicht', color: SERIES(2) }, { label: 'Wach', color: cv('--other') }] })}
    ${chartCard({ id: 'ch-vo2', title: 'VO₂max – Trend', sub: 'Garmin-Schätzung (Laufen), 14-Tage-Prognose', legend: [{ label: 'VO₂max', color: SERIES(0) }, { label: 'Prognose', color: cv('--text-2'), dash: true }] })}
    ${D.pred ? `<section class="card c12" style="grid-column:span 12"><div class="hd"><div><h2>Rennprognosen (Garmin)</h2><div class="sub">Basierend auf VO₂max und aktueller Form</div></div></div><div class="tiles">${[['5k', '5 km', 5], ['10k', '10 km', 10], ['hm', 'Halbmarathon', 21.0975], ['m', 'Marathon', 42.195]].map(([k, l, km]) => D.pred[k] ? tile('🏁', l, fmtHM(D.pred[k]), '', `${fmtPace(D.pred[k] / km)} /km`) : '').join('')}</div></section>` : ''}
  </div>`;

  // Diagramme
  const N = 28; const hist = dl.slice(-N); const plan = buildPlan();
  const planLoad = Object.fromEntries(plan.days.map(d => [d.date, d.load]));
  const proj = projectLoad(7, App.fcMode === 'rest' ? {} : planLoad) || [];
  const pad = a => a.concat(Array(proj.length).fill(null));
  const labels = hist.map(d => shortDate(d.d)).concat(proj.map(p => shortDate(p.d)));
  const joinA = pad(hist.map(d => null)); const joinC = joinA.slice();
  const projA = hist.map((d, i) => i === hist.length - 1 ? d.atl : null).concat(proj.map(p => Math.round(p.atl)));
  const projC = hist.map((d, i) => i === hist.length - 1 ? d.ctl : null).concat(proj.map(p => Math.round(p.ctl)));
  lineChart($('#ch-load'), labels, [
    { label: 'Akutlast', data: pad(hist.map(d => d.atl)), color: 1 }, { label: 'Chronische Last', data: pad(hist.map(d => d.ctl)), color: 0 },
    { label: 'Akutlast (Prognose)', data: projA, color: 1, dash: true }, { label: 'Chronische Last (Prognose)', data: projC, color: 0, dash: true }
  ], { decimals: 0, xTicks: 7 });

  const trendChart = (id, key, unit, color) => {
    const H = dl.slice(-35); const vals = H.map(d => d[key]); const ma = movingAvg(vals, 7);
    const f = forecast(ma.filter(v => v != null), 14, 10);
    const lb = H.map(d => shortDate(d.d)).concat(dayLabels(addDays(H.at(-1).d, 1), 10));
    const fdata = vals.map((_, i) => i === vals.length - 1 ? ma[i] : null).concat(f ? f.values.map(v => +v.toFixed(1)) : Array(10).fill(null));
    lineChart($('#' + id), lb, [{ label: 'Nacht', data: vals.concat(Array(10).fill(null)), color: 0, width: 1.5, points: true }, { label: '7-Tage-Ø', data: ma.concat(Array(10).fill(null)), color: 1, width: 2.5 }, { label: '7-Tage-Ø (Prognose)', data: fdata, color: 1, dash: true, width: 2.5 }], { decimals: key === 'hrv' ? 0 : 0, unit, xTicks: 7 });
    if (f) { const c = $('#' + id).closest('.card'); const wk = f.slopePerDay * 7; const good = key === 'hrv' ? wk > 0 : wk < 0; c.insertAdjacentHTML('beforeend', `<p class="note">Trend (2 Wochen): ${nf(wk, 1)} ${unit} pro Woche – ${Math.abs(wk) < 0.5 ? 'stabil' : good ? 'günstig' : 'ungünstig'}. In 10 Tagen etwa ${nf(f.values.at(-1))} ${unit}.</p>`); }
  };
  trendChart('ch-hrv', 'hrv', 'ms'); trendChart('ch-rhr', 'rhr', 'bpm');

  const s14 = dl.slice(-14);
  barChart($('#ch-sleep14'), s14.map(d => shortDate(d.d)), [
    { label: 'Tief', data: s14.map(d => d.deep != null ? +(d.deep / 60).toFixed(2) : null), color: 0 }, { label: 'REM', data: s14.map(d => d.rem != null ? +(d.rem / 60).toFixed(2) : null), color: 1 },
    { label: 'Leicht', data: s14.map(d => d.light != null ? +(d.light / 60).toFixed(2) : null), color: 2 }, { label: 'Wach', data: s14.map(d => d.awake != null ? +(d.awake / 60).toFixed(2) : null), color: cv('--other') }
  ], { stacked: true, decimals: 1, unit: 'h', xTicks: 7 });

  const V = dl.slice(-56).filter(d => d.vo2 != null); const vf = forecast(V.map(d => d.vo2), 28, 14);
  const vl = V.map(d => shortDate(d.d)).concat(dayLabels(addDays(V.at(-1).d, 1), 14));
  lineChart($('#ch-vo2'), vl, [{ label: 'VO₂max', data: V.map(d => d.vo2).concat(Array(14).fill(null)), color: 0 }, { label: 'Prognose', data: V.map((d, i) => i === V.length - 1 ? d.vo2 : null).concat(vf ? vf.values.map(v => +v.toFixed(2)) : Array(14).fill(null)), color: 0, dash: true }], { decimals: 1, xTicks: 7 });
  if (vf) $('#ch-vo2').closest('.card').insertAdjacentHTML('beforeend', `<p class="note">Trend: ${nf(vf.slopePerDay * 30, 1)} pro Monat. Garmin glättet stark – Richtung zählt mehr als einzelne Werte.</p>`);
  wireTables(el, { 'ch-sleep14': 1, 'ch-vo2': 1 });
  $$('[data-fc]', el).forEach(b => b.addEventListener('click', () => { App.fcMode = b.dataset.fc; render(); }));
}

/* ================= RÜCKBLICK ================= */
function renderReview(el) {
  const D = App.data, to = D.asOf, first = [D.daily[0]?.d, D.acts[0]?.date].filter(Boolean).sort()[0] || to;
  const span = diffDays(to, first) + 1;
  const opts = [['4w', '4 Wochen', 28], ['8w', '8 Wochen', 56]]; if (span > 60) opts.push(['all', 'Alles', span]);
  if (!opts.find(o => o[0] === App.range)) App.range = '8w';
  const days = Math.min(opts.find(o => o[0] === App.range)[2], span), from = addDays(to, -(days - 1));
  const pFrom = addDays(from, -days), pTo = addDays(from, -1);
  const list = actsBetween(from, to), S = summarize(list), hasPrev = pFrom >= first;
  const P = hasPrev ? summarize(actsBetween(pFrom, pTo)) : null;
  const dp = (a, b, d = 0, u = '') => P && b ? delta((a - b) / b * 100, 0, ' %') : '';
  const dl = D.daily.filter(d => d.d >= from && d.d <= to);
  const runs = list.filter(a => a.sport === 'run' && a.dist >= 3000);
  const zd = zoneDistribution(list);
  const ZC = ['#9ec5f4', '#6da7ec', '#3987e5', '#1c5cab', '#104281']; const ZN = ['Z1 Erholung', 'Z2 Grundlage', 'Z3 Tempo', 'Z4 Schwelle', 'Z5 Maximal'];
  // Bestleistungen
  const best = (f, c) => { const l = list.filter(f); return l.length ? l.reduce((a, b) => c(a) >= c(b) ? a : b) : null; };
  const lr = best(a => a.sport === 'run', a => a.dist), fr = best(a => a.sport === 'run' && a.dist >= 5000, a => -paceOf(a));
  const lb = best(a => SPORTS[a.sport].group === 'Rad', a => a.dist), eb = best(a => true, a => a.elev);
  const rec = (t, a, v, sub) => a ? `<tr><td>${t}</td><td class="num"><b>${v}</b></td><td class="num muted">${fmtDate(a.date)} · ${sub}</td></tr>` : '';
  const sportsPresent = [...new Set(list.map(a => a.sport))];

  el.innerHTML = `
  <div class="page-head"><div><h1>Rückblick</h1><div class="sub">${fmtDate(from)} – ${fmtDate(to)} · ${days} Tage</div></div>
    <div class="seg" role="group" aria-label="Zeitraum">${opts.map(o => `<button data-range="${o[0]}" aria-pressed="${App.range === o[0]}">${o[1]}</button>`).join('')}</div></div>
  <div class="tiles">
    ${tile('🗓️', 'Einheiten', nf(S.n), '', P ? `Vorperiode ${nf(P.n)}` : '')}
    ${tile('📏', 'Distanz', nf(S.dist / 1000, 0), 'km', P ? `${dp(S.dist, P.dist)} zur Vorperiode` : `Laufen ${fmtKm(S.run)} · Rad ${fmtKm(S.bike)}`)}
    ${tile('⏱️', 'Zeit', fmtDur(S.dur), '', P ? `${dp(S.dur, P.dur)} zur Vorperiode` : '')}
    ${tile('⛰️', 'Höhenmeter', nf(S.elev), 'm', `${nf(S.kcal)} kcal aktiv`)}
  </div>
  <div class="spacer"></div>
  <div class="grid">
    ${chartCard({ id: 'rv-week', title: 'Wochenumfang', sub: 'Trainingszeit pro Woche in Stunden', cls: 'c8', legend: [{ label: 'Laufen', color: SERIES(0) }, { label: 'Rad (MTB/Gravel/Rennrad)', color: SERIES(1) }, { label: 'Andere', color: SERIES(2) }] })}
    <section class="card c4"><div class="hd"><div><h2>Intensitätsverteilung</h2><div class="sub">Zeitanteil nach Ø-Herzfrequenz (ohne Gehen)</div></div></div>
      ${zd.known ? zd.t.map((t, i) => `<div style="margin:8px 0"><div class="sub" style="display:flex;justify-content:space-between"><span>${ZN[i]} <span class="muted">(${i < 4 ? D.profile.zones[i] + '–' + (D.profile.zones[i + 1] - 1) : 'ab ' + D.profile.zones[4]} bpm)</span></span><b style="color:var(--text)">${nf(t / zd.known * 100)} %</b></div><div class="bar"><i style="width:${t / zd.known * 100}%;background:${ZC[i]}"></i></div></div>`).join('') + `<p class="note">Faustregel Ausdauer: etwa 70–80 % in Zone 1–2, der Rest hart. ${(zd.t[3] + zd.t[4]) / zd.known > .4 ? 'Bei dir liegt ein großer Teil in Zone 4–5.' : ''}</p>` : '<p class="sub">Keine Herzfrequenzdaten.</p>'}
    </section>
    ${chartCard({ id: 'rv-pace', title: 'Laufpace je Lauf', sub: 'Läufe ab 3 km, min/km (niedriger = schneller)', legend: [{ label: 'Pace', color: SERIES(0) }, { label: 'Ø-Herzfrequenz', color: SERIES(1) }].slice(0, 1) })}
    ${chartCard({ id: 'rv-hr', title: 'Ø-Herzfrequenz je Lauf', sub: 'Läufe ab 3 km', legend: [] })}
    ${chartCard({ id: 'rv-sleep', title: 'Schlaf', sub: 'Dauer in Stunden, Mittel über 7 Nächte', legend: [{ label: 'Nacht', color: SERIES(0) }, { label: '7-Nächte-Ø', color: SERIES(1) }] })}
    ${chartCard({ id: 'rv-score', title: 'Schlafscore', sub: 'Garmin-Bewertung 0–100', legend: [{ label: 'Score', color: SERIES(0) }, { label: '7-Nächte-Ø', color: SERIES(1) }] })}
    ${chartCard({ id: 'rv-hrv', title: 'HRV', sub: 'Nächtlicher Durchschnitt in ms', legend: [{ label: 'Nacht', color: SERIES(0) }, { label: '7-Tage-Ø', color: SERIES(1) }] })}
    ${chartCard({ id: 'rv-rhr', title: 'Ruhepuls', sub: 'bpm', legend: [{ label: 'Nacht', color: SERIES(0) }, { label: '7-Tage-Ø', color: SERIES(1) }] })}
    ${chartCard({ id: 'rv-steps', title: 'Schritte', sub: `Tagesziel ${nf(D.profile.stepGoal)}`, legend: [{ label: 'Schritte', color: SERIES(0) }, { label: 'Ziel', color: cv('--text-2'), dash: true }] })}
    ${chartCard({ id: 'rv-load', title: 'Trainingslast (Garmin)', sub: 'Akut (7 Tage) und chronisch (28 Tage)', legend: [{ label: 'Akutlast', color: SERIES(1) }, { label: 'Chronische Last', color: SERIES(0) }] })}
    <section class="card c6"><div class="hd"><h2>Bestleistungen im Zeitraum</h2></div><div class="table-wrap"><table><tbody>
      ${rec('Längster Lauf', lr, lr && fmtKm(lr.dist) + ' km', lr && fmtDur(lr.dur))}
      ${rec('Schnellster Lauf ≥ 5 km', fr, fr && fmtPace(paceOf(fr)) + ' /km', fr && fmtKm(fr.dist) + ' km')}
      ${rec('Längste Radtour', lb, lb && fmtKm(lb.dist) + ' km', lb && SPORTS[lb.sport].label)}
      ${rec('Meiste Höhenmeter', eb, eb && nf(eb.elev) + ' m', eb && SPORTS[eb.sport].label)}
    </tbody></table></div></section>
    <section class="card c6"><div class="hd"><h2>Aktivitäten</h2><div class="seg" id="act-filter">${['alle', ...sportsPresent].map(s => `<button data-f="${s}" aria-pressed="${(App.actFilter || 'alle') === s}">${s === 'alle' ? 'Alle' : SPORTS[s].label}</button>`).join('')}</div></div>
      <div class="acts" style="max-height:420px;overflow:auto" id="act-list"></div></section>
  </div>`;

  // Wochenumfang
  const wks = weekly(from, to);
  barChart($('#rv-week'), wks.map(w => shortDate(w.w) + (w.w === weekStart(to) ? ' *' : '')), ['Laufen', 'Rad', 'Andere'].map((g, i) => ({ label: g, data: wks.map(w => +w.g[g].toFixed(2)), color: i })), {
    stacked: true, decimals: 1, unit: 'h', xTicks: 12,
    tipExtra: items => { const w = wks[items[0].dataIndex]; return [`Σ ${nf(sum(Object.values(w.g)), 1)} h · Laufen ${nf(w.km.Laufen, 0)} km · Rad ${nf(w.km.Rad, 0)} km · ${nf(w.elev)} Hm`]; }
  });
  if (wks.some(w => w.w === weekStart(to))) $('#rv-week').closest('.card').insertAdjacentHTML('beforeend', '<p class="note">* laufende Woche, noch nicht abgeschlossen.</p>');
  // Pace / HR
  const rl = runs.map(a => shortDate(a.date));
  const pcs = runs.map(a => +(paceOf(a) / 60).toFixed(2));
  lineChart($('#rv-pace'), rl, [{ label: 'Pace (min/km)', data: pcs, color: 0, points: true }], { decimals: 2, unit: 'min/km', xTicks: 10 });
  const pc = $('#rv-pace')._chart; pc.options.scales.y.ticks.callback = v => fmtPace(v * 60); pc.options.plugins.tooltip.callbacks.label = c => ` Pace: ${fmtPace(c.parsed.y * 60)} /km`; pc.update();
  lineChart($('#rv-hr'), rl, [{ label: 'Ø-Herzfrequenz', data: runs.map(a => a.hr), color: 1, points: true }], { decimals: 0, unit: 'bpm', xTicks: 10 });
  const dlab = dl.map(d => shortDate(d.d));
  const withMa = (key, id, cfg = {}) => lineChart($('#' + id), dlab, [{ label: cfg.l1 || 'Nacht', data: dl.map(d => d[key]), color: 0, width: 1.5, points: false }, { label: cfg.l2 || '7-Tage-Ø', data: movingAvg(dl.map(d => d[key]), 7), color: 1, width: 2.5 }], { decimals: cfg.dec ?? 0, unit: cfg.unit || '', xTicks: 8, yMin: cfg.yMin });
  withMa('sleep', 'rv-sleep', { l2: '7-Nächte-Ø', unit: 'h', dec: 1 }); withMa('score', 'rv-score', { l2: '7-Nächte-Ø', yMin: 0 });
  withMa('hrv', 'rv-hrv', { unit: 'ms' }); withMa('rhr', 'rv-rhr', { unit: 'bpm' });
  barChart($('#rv-steps'), dlab, [{ label: 'Schritte', data: dl.map(d => d.steps), color: 0 }, { type: 'line', label: 'Ziel', data: dl.map(() => D.profile.stepGoal), color: cv('--text-2'), dash: true }], { decimals: 0, xTicks: 8 });
  lineChart($('#rv-load'), dlab, [{ label: 'Akutlast', data: dl.map(d => d.atl), color: 1 }, { label: 'Chronische Last', data: dl.map(d => d.ctl), color: 0 }], { decimals: 0, xTicks: 8 });
  wireTables(el, { 'rv-week': 1, 'rv-pace': 2, 'rv-sleep': 1 });
  $$('[data-range]', el).forEach(b => b.addEventListener('click', () => { App.range = b.dataset.range; render(); }));
  const drawActs = () => { const f = App.actFilter || 'alle'; $('#act-list').innerHTML = list.filter(a => f === 'alle' || a.sport === f).slice().reverse().map(actRow).join(''); $$('#act-filter button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f)); };
  $$('#act-filter button').forEach(b => b.addEventListener('click', () => { App.actFilter = b.dataset.f; drawActs(); }));
  drawActs();
}

/* ================= TRAINING ================= */
function renderTrain(el) {
  const D = App.data, tab = App.trainTab || 'plan';
  el.innerHTML = `<div class="page-head"><div><h1>Training</h1><div class="sub">Vorschläge aus deinen Daten · Routen für Komoot</div></div>
    <div class="seg" role="group" aria-label="Bereich"><button data-tt="plan" aria-pressed="${tab === 'plan'}">Vorschläge</button><button data-tt="route" aria-pressed="${tab === 'route'}">Routenplaner</button></div></div><div id="train-body"></div>`;
  $$('[data-tt]', el).forEach(b => b.addEventListener('click', () => { App.trainTab = b.dataset.tt; render(); }));
  const body = $('#train-body');
  if (tab === 'route') renderRoutes(body); else renderPlan(body);
}

function renderPlan(el) {
  const D = App.data, P = App.prefs, plan = buildPlan(), rec = recommendToday(), ins = buildInsights().filter(i => i.tone !== 'info');
  const sel = (id, opts, v) => `<label class="f">${id[1]}<select id="${id[0]}">${Object.entries(opts).map(([k, l]) => `<option value="${k}" ${String(v) === k ? 'selected' : ''}>${esc(typeof l === 'string' ? l : l.label)}</option>`).join('')}</select></label>`;
  const totalMin = sum(plan.days.map(d => d.min)), n = plan.days.filter(d => d.type !== 'rest').length;
  el.innerHTML = `
  <div class="grid">
    <section class="card c12" style="grid-column:span 12"><div class="row">
      ${sel(['p-goal', 'Ziel'], GOALS, P.goal)}${sel(['p-focus', 'Schwerpunkt'], FOCUS, P.focus)}
      ${sel(['p-days', 'Einheiten pro Woche'], { 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' }, P.days)}
      <div class="sub" style="flex:1;min-width:220px">Wochenumfang aus deiner Historie: <b>${nf(plan.base.runKm, 0)} km Laufen</b>, ${nf(plan.base.bikeH, 1)} h Rad pro Woche. Pace-Vorgaben aus Garmins 10-km-Prognose (${fmtHM(D.pred?.['10k'] || plan.pm.p10 * 10)}).</div></div></section>
    <section class="card c12" style="grid-column:span 12"><div class="hd"><div><h2>Die nächsten 7 Tage</h2><div class="sub">${n} Einheiten · ${fmtDur(totalMin * 60)} · ${nf(plan.totalKm, 0)} km Laufen geplant</div></div></div>
      <div class="days">${plan.days.map(d => `<div class="day ${d.type === 'rest' ? 'rest' : ''}"><div class="dt"><b>${pd(d.date).getUTCDate()}</b><span>${WD[wdOf(d.date)]}</span></div>
        <div><h3>${d.sport ? SPORTS[d.sport].icon + ' ' : ''}${esc(d.title)}</h3><p>${esc(d.desc)}</p>${d.type !== 'rest' ? `<div class="chips">${d.min ? `<span class="chip">⏱ ${d.min} min</span>` : ''}${d.km ? `<span class="chip">📏 ca. ${d.km} km</span>` : ''}<span class="chip">Zone ${esc(d.zone)}</span>${d.hr !== '–' ? `<span class="chip">❤️ ${esc(d.hr)}</span>` : ''}${d.pace ? `<span class="chip">⚡ ${esc(d.pace)}</span>` : ''}</div>` : ''}</div>
        <div class="go">${d.sport && d.sport !== 'str' && d.km ? `<button class="btn small" data-route='${JSON.stringify({ sport: d.sport, km: d.km, min: d.min }).replace(/'/g, '&#39;')}'>Route planen</button>` : ''}</div></div>`).join('')}</div>
      <p class="note">Heute zählt die Tagesform: ${rec ? esc(rec.title) + ' – ' + esc(rec.text) : ''}</p></section>
    ${chartCard({ id: 'tp-load', title: 'Wirkung des Plans auf deine Belastung', sub: 'Akutlast: mit Plan vs. ohne Training', cls: 'c8', legend: [{ label: 'Bisher', color: SERIES(1) }, { label: 'Mit Plan', color: SERIES(0), dash: true }, { label: 'Nur Ruhe', color: cv('--text-2'), dash: true }] })}
    <section class="card c4"><div class="hd"><h2>Warum dieser Plan?</h2></div>
      ${ins.map(i => `<p class="note" style="margin:0 0 10px">${i.tone === 'warn' ? '⚠️' : '✅'} ${esc(i.text)}</p>`).join('')}
      <p class="note" style="margin:0">Langer Lauf ${plan.longKm} km orientiert sich an deinem längsten Lauf der letzten 8 Wochen. Pro Woche steigt der Umfang höchstens um ${nf(plan.goal.growth * 100)} %.</p></section>
  </div>`;
  ['p-goal:goal', 'p-focus:focus', 'p-days:days'].forEach(s => { const [id, k] = s.split(':'); $('#' + id).addEventListener('change', e => { App.prefs[k] = k === 'days' ? +e.target.value : e.target.value; savePrefs(); render(); }); });
  $$('[data-route]', el).forEach(b => b.addEventListener('click', () => { App.routePrefill = JSON.parse(b.dataset.route); App.trainTab = 'route'; render(); window.scrollTo({ top: 0 }); }));
  // Diagramm
  const last = D.daily.at(-1); const hist = D.daily.slice(-14);
  const planLoad = Object.fromEntries(plan.days.map(d => [d.date, d.load]));
  const a = projectLoad(7, planLoad), b = projectLoad(7, {});
  if (a && last) {
    const lb = hist.map(d => shortDate(d.d)).concat(a.map(p => shortDate(p.d)));
    const padN = Array(a.length).fill(null);
    const join = v => hist.map((d, i) => i === hist.length - 1 ? v : null);
    lineChart($('#tp-load'), lb, [{ label: 'Akutlast bisher', data: hist.map(d => d.atl).concat(padN), color: 1 }, { label: 'Akutlast mit Plan', data: join(last.atl).concat(a.map(p => Math.round(p.atl))), color: 0, dash: true }, { label: 'Akutlast nur Ruhe', data: join(last.atl).concat(b.map(p => Math.round(p.atl))), color: cv('--text-2'), dash: true }], { decimals: 0, xTicks: 8 });
    const okA = a.find(p => p.acwr != null && p.acwr <= 1.3), okR = b.find(p => p.acwr != null && p.acwr <= 1.3);
    $('#tp-load').closest('.card').insertAdjacentHTML('beforeend', `<p class="note">${last.acwr > 1.3 ? `Aktuell ACWR ${nf(last.acwr, 1)}. ${okR ? `Ohne Training wärst du ab ${fmtDateL(okR.d)} wieder im optimalen Bereich.` : ''}` : `ACWR ${nf(last.acwr, 1)} – im optimalen Bereich.`} Mit Plan: ACWR am Ende der Woche ca. ${nf(a.at(-1).acwr, 1)}${okA ? '' : ''}.</p>`);
  }
  wireTables(el, {});
}
