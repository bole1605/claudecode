/* Diagramme (Chart.js) – Farben aus CSS-Variablen, Hell/Dunkel, Tooltips, Tabellenansicht */
'use strict';
const Charts = { all: [] };
const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const SERIES = i => cv('--s' + (i + 1));
const SPORT_COLOR = { Laufen: () => SERIES(0), Rad: () => SERIES(1), Andere: () => SERIES(2) };

function destroyCharts() { Charts.all.forEach(c => { try { c.destroy(); } catch { } }); Charts.all = []; }

function baseOptions({ unit = '', legend = false, decimals = 0, yMin, yMax, stacked = false, xTicks = 6, tipExtra } = {}) {
  const text2 = cv('--text-2'), muted = cv('--muted'), grid = cv('--grid'), surface = cv('--surface'), text = cv('--text');
  return {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: surface, titleColor: text, bodyColor: text2, borderColor: grid, borderWidth: 1, padding: 10, boxPadding: 4, usePointStyle: true,
        filter: it => it.raw != null,
        callbacks: {
          label: c => { const v = c.parsed.y; if (v == null) return null; return ` ${c.dataset.label}: ${nf(v, decimals)}${unit ? ' ' + unit : ''}`; },
          afterBody: tipExtra
        }
      }
    },
    scales: {
      x: { stacked, grid: { display: false }, border: { color: cv('--axis') }, ticks: { color: muted, font: { size: 11 }, maxTicksLimit: xTicks, maxRotation: 0 } },
      y: { stacked, min: yMin, max: yMax, grid: { color: grid }, border: { display: false }, ticks: { color: muted, font: { size: 11 }, maxTicksLimit: 6, callback: v => nf(v, decimals) } }
    }
  };
}

/** Legende (immer bei >= 2 Serien) – HTML, damit sie auch gedruckt/als Text lesbar bleibt */
function legendHtml(items) {
  if (items.length < 2) return '';
  return `<div class="legend">${items.map(i => `<span><i class="${i.dash ? 'dash' : ''}" style="background:${i.color};color:${i.color}"></i>${esc(i.label)}</span>`).join('')}</div>`;
}

function mount(canvas, config) {
  const c = new Chart(canvas, config); Charts.all.push(c); canvas._chart = c; return c;
}

/**
 * Liniendiagramm. series: [{label,data,color(Index/Hex),dash,width,fill}]
 * opts.forecastFrom: Index, ab dem eine zusätzliche gestrichelte Prognose startet (nur Optik über dash-Serien)
 */
function lineChart(canvas, labels, series, o = {}) {
  const ds = series.map((s, i) => ({
    label: s.label, data: s.data, borderColor: typeof s.color === 'number' ? SERIES(s.color) : s.color, backgroundColor: typeof s.color === 'number' ? SERIES(s.color) : s.color,
    borderWidth: s.width || 2, borderDash: s.dash ? [6, 5] : [], pointRadius: s.points ? 3 : 0, pointHoverRadius: 5, pointBorderColor: cv('--surface'), pointBorderWidth: 2,
    tension: 0.25, spanGaps: true, fill: s.fill ? 'origin' : false, order: s.order ?? i
  }));
  const opt = baseOptions(o);
  if (o.band) { /* Optimalbereich als Linienpaar */ }
  return mount(canvas, { type: 'line', data: { labels, datasets: ds }, options: opt });
}

function barChart(canvas, labels, series, o = {}) {
  const stacked = !!o.stacked;
  const ds = series.map(s => ({
    type: s.type || 'bar', label: s.label, data: s.data,
    backgroundColor: typeof s.color === 'number' ? SERIES(s.color) : s.color, borderColor: typeof s.color === 'number' ? SERIES(s.color) : s.color,
    borderRadius: s.type === 'line' ? 0 : 4, borderSkipped: stacked ? false : 'bottom', maxBarThickness: 28,
    ...(stacked ? { borderColor: cv('--surface'), borderWidth: 2 } : {}),
    ...(s.type === 'line' ? { borderWidth: 2, pointRadius: 0, borderDash: s.dash ? [6, 5] : [], tension: 0, stepped: false, order: -1 } : {}),
    ...(s.colors ? { backgroundColor: s.colors } : {})
  }));
  const opt = baseOptions({ ...o, stacked });
  return mount(canvas, { type: 'bar', data: { labels, datasets: ds }, options: opt });
}

/** Tabellenansicht aus den Chart-Daten (Barrierefreiheit) */
function tableFromChart(chart, decimals = 0) {
  const labels = chart.data.labels; const ds = chart.data.datasets;
  const head = `<tr><th>Zeitraum</th>${ds.map(d => `<th class="num">${esc(d.label)}</th>`).join('')}</tr>`;
  const body = labels.map((l, i) => `<tr><td>${esc(l)}</td>${ds.map(d => `<td class="num">${d.data[i] == null ? '–' : nf(d.data[i], decimals)}</td>`).join('')}</tr>`).join('');
  return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
}

/** Karten-HTML für ein Diagramm: Titel, Legende, Canvas, Tabellen-Umschalter */
function chartCard({ id, title, sub, legend = [], cls = 'c6', height = '', note = '' }) {
  return `<section class="card ${cls}" data-chart="${id}">
    <div class="hd"><div><h2>${esc(title)}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="tbtn" data-table="${id}" aria-expanded="false">Tabelle</button></div>
    ${legendHtml(legend)}
    <div class="chart ${height}"><canvas id="${id}" role="img" aria-label="${esc(title)}"></canvas></div>
    ${note ? `<p class="note">${note}</p>` : ''}
    <div class="tbl" hidden></div>
  </section>`;
}

function wireTables(root, decimalsMap = {}) {
  $$('[data-table]', root).forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.table; const card = b.closest('[data-chart]'); const box = $('.tbl', card);
    const open = box.hidden; box.hidden = !open; b.setAttribute('aria-expanded', open);
    b.textContent = open ? 'Diagramm' : 'Tabelle';
    $('.chart', card).hidden = open;
    if (open) { const ch = document.getElementById(id)._chart; box.innerHTML = ch ? tableFromChart(ch, decimalsMap[id] ?? 0) : ''; }
  }));
}
