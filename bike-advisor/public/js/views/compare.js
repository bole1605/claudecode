import { h, mount } from '../dom.js';
import { compare, results, wishlist } from '../store.js';
import { fmtEUR } from '/shared/util.js';
import { TYPE_LABEL } from '/shared/taxonomy.js';
import { specText } from '../components/bikeCard.js';
import { placeholderImg } from '../components/bikeCard.js';

const DT_RANK = { electronic: 3, chain: 2, hub: 1 };
const BR_RANK = { hydraulic: 3, mechanical: 2, rim: 1 };
const SU_RANK = { full: 3, fork: 2, none: 1 };

// key, Label, Wert, Anzeige, Richtung ('min' | 'max' | null), Gewicht für Empfehlung
const ROWS = [
  { k: 'match', label: 'Matching-Score', val: (b) => b.match?.score, fmt: (v) => `${v} %`, dir: 'max', w: 3 },
  { k: 'price', label: 'Preis', val: (b) => b.price.amount, fmt: fmtEUR, dir: 'min', w: 2 },
  { k: 'weight', label: 'Gewicht', val: (b) => b.weightKg, fmt: (v) => `${v} kg`, dir: 'min', w: 1 },
  { k: 'power', label: 'Motorleistung', val: (b) => b.motor?.powerW, fmt: (v) => `${v} W`, dir: 'max', w: 0.5 },
  { k: 'torque', label: 'Drehmoment', val: (b) => b.motor?.torqueNm, fmt: (v) => `${v} Nm`, dir: 'max', w: 1 },
  { k: 'battery', label: 'Akkukapazität', val: (b) => b.battery?.wh, fmt: (v) => `${v} Wh`, dir: 'max', w: 1 },
  { k: 'range', label: 'Reichweite (geschätzt)', val: (b) => b.match?.estimatedRange, fmt: (v) => `≈ ${v} km`, dir: 'max', w: 1.5 },
  { k: 'drivetrain', label: 'Schaltung', val: (b) => DT_RANK[b.drivetrain?.type], fmt: (_, b) => specText.drivetrain(b), dir: 'max', w: 0.5 },
  { k: 'brakes', label: 'Bremsen', val: (b) => BR_RANK[b.brakes?.type], fmt: (_, b) => specText.brakes(b), dir: 'max', w: 0.5 },
  { k: 'suspension', label: 'Federung / Federweg', val: (b) => (b.suspension?.type ? SU_RANK[b.suspension.type] * 1000 + Math.max(b.suspension.travelFrontMm ?? 0, b.suspension.travelRearMm ?? 0) : null), fmt: (_, b) => specText.suspension(b), dir: null, w: 0 },
  { k: 'features', label: 'Ausstattung (erfüllte Merkmale)', val: (b) => Object.values(b.features ?? {}).filter(Boolean).length || null, fmt: (v) => `${v} Merkmale`, dir: 'max', w: 0.5 },
  { k: 'warranty', label: 'Garantie', val: () => null, fmt: (_, b) => b.warranty, dir: null, w: 0 },
  { k: 'frame', label: 'Rahmengrößen', val: () => null, fmt: (_, b) => b.frameSizes?.join(', '), dir: null, w: 0 },
  { k: 'material', label: 'Rahmenmaterial', val: () => null, fmt: (_, b) => ({ aluminium: 'Aluminium', carbon: 'Carbon', steel: 'Stahl' }[b.material]), dir: null, w: 0 },
];

export function compareBikes(bikes) {
  const rows = ROWS.map((r) => {
    const vals = bikes.map((b) => r.val(b));
    const known = vals.filter((v) => v != null);
    let winners = [];
    if (r.dir && known.length >= 2) {
      const best = r.dir === 'max' ? Math.max(...known) : Math.min(...known);
      if (new Set(known).size > 1) winners = vals.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    }
    const shown = bikes.map((b, i) => (vals[i] != null || r.fmt.length === 0 || ['drivetrain', 'brakes', 'suspension', 'warranty', 'frame', 'material'].includes(r.k) ? r.fmt(vals[i], b) : null));
    const differs = new Set(shown.map((s) => s ?? '∅')).size > 1;
    return { ...r, vals, shown, winners, differs };
  }).filter((r) => r.shown.some((s) => s != null));
  const points = bikes.map(() => 0);
  for (const r of rows) for (const i of r.winners) points[i] += r.w;
  const order = points.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
  const top = order[0][1];
  const reasons = rows.filter((r) => r.winners.includes(top) && r.w >= 1).map((r) => r.label);
  return { rows, points, top, reasons, tie: order.length > 1 && order[0][0] === order[1][0] };
}

export function compareView(root) {
  const pool = [...(results.get()?.result?.results ?? []), ...wishlist.list()];
  const unique = new Map(pool.map((b) => [b.id, b]));
  const bikes = compare.list().map((id) => unique.get(id)).filter(Boolean);
  if (bikes.length < 2) {
    return mount(root, h('div', { class: 'container narrow' }, h('div', { class: 'panel' }, h('h2', null, 'Vergleich'), h('p', null, 'Wähle mindestens zwei (maximal vier) Fahrräder über „Vergleichen“ aus den Ergebnissen oder der Wunschliste.'),
      h('a', { class: 'btn primary', href: '#/results' }, 'Zu den Ergebnissen'))));
  }
  const c = compareBikes(bikes);
  const winner = bikes[c.top];
  mount(root, h('div', { class: 'container' },
    h('h2', null, `Vergleich (${bikes.length} Fahrräder)`),
    h('div', { class: 'table-wrap' }, h('table', { class: 'compare' },
      h('thead', null, h('tr', null, h('th', null, ''), bikes.map((b, i) => h('th', { scope: 'col', class: i === c.top && !c.tie ? 'win' : '' },
        h('div', { class: 'cmp-img' }, b.imageUrl ? h('img', { src: b.imageUrl, alt: '', referrerPolicy: 'no-referrer', loading: 'lazy', onError: (e) => e.target.replaceWith(placeholderImg()) }) : placeholderImg()),
        h('strong', null, b.brand), h('div', null, b.model), h('small', null, TYPE_LABEL[b.type]),
        h('a', { href: b.url, target: '_blank', rel: 'noopener noreferrer nofollow', class: 'small-link' }, 'Zum Angebot ↗'))))),
      h('tbody', null, c.rows.map((r) => h('tr', { class: r.differs ? 'diff' : '' }, h('th', { scope: 'row' }, r.label),
        r.shown.map((s, i) => h('td', { class: c.rows && r.winners.includes(i) ? 'best' : '' }, s ?? h('span', { class: 'unk' }, 'nicht verifiziert'), r.winners.includes(i) ? h('span', { class: 'crown', title: 'Beste Wahl in dieser Kategorie' }, ' ✓') : null))))))),
    h('div', { class: 'panel recommend' }, h('h3', null, 'Empfehlung'),
      c.tie ? h('p', null, 'Die Modelle liegen insgesamt gleichauf. Entscheide nach den hervorgehobenen Unterschieden und deinen Muss-Kriterien.')
        : h('p', null, h('strong', null, `${winner.brand} ${winner.model}`), ` schneidet insgesamt am besten ab (${winner.match?.score ?? '–'} % Match).`, c.reasons.length ? ` Vorn liegt es bei: ${c.reasons.join(', ')}.` : ''),
      bikes.some((b) => b.match?.fails?.length) ? h('p', { class: 'callout warn' }, 'Hinweis: Mindestens ein Modell verfehlt Muss-Kriterien – das fließt in den Matching-Score ein. Fehlende („nicht verifizierte“) Daten wurden in keiner Kategorie als Vorteil gewertet.') : null),
    h('button', { class: 'btn ghost', type: 'button', onClick: () => { compare.clear(); compareView(root); } }, 'Auswahl leeren')));
}
