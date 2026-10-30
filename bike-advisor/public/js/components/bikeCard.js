import { h } from '../dom.js';
import { fmtEUR } from '/shared/util.js';
import { TYPE_LABEL, DRIVES } from '/shared/taxonomy.js';
import { wishlist, compare } from '../store.js';

const VERDICT = {
  excellent: ['Sehr gute Passung', 'good'], good: ['Gute Passung', 'good'], compromise: ['Kompromiss', 'warn'],
  unverified: ['Teils nicht verifiziert', 'warn'], mismatch: ['Muss-Kriterium nicht erfüllt', 'bad'],
};
const VERIF = { verified: ['Verifiziert', 'good'], partial: ['Teilweise bestätigt', 'warn'], unverified: ['Nicht verifiziert', 'bad'], stale: ['Katalogdaten veraltet', 'warn'] };
const SUSP = { none: 'Ungefedert', fork: 'Federgabel', full: 'Fully' };
const BRAKE = { hydraulic: 'Hydr. Scheibenbremsen', mechanical: 'Mech. Scheibenbremsen', rim: 'Felgenbremsen' };
const DT = { chain: 'Kettenschaltung', hub: 'Nabenschaltung', electronic: 'Elektronische Schaltung' };

export const specText = {
  drivetrain: (b) => (b.drivetrain ? [DT[b.drivetrain.type], b.drivetrain.gears ? `${b.drivetrain.gears}-Gang` : null, b.drivetrain.name ?? b.drivetrain.brand].filter(Boolean).join(' · ') || null : null),
  brakes: (b) => (b.brakes?.type ? [BRAKE[b.brakes.type], b.brakes.name].filter(Boolean).join(' · ') : null),
  suspension: (b) => (b.suspension?.type ? [SUSP[b.suspension.type], b.suspension.travelFrontMm ? `${b.suspension.travelFrontMm} mm` : null, b.suspension.travelRearMm ? `hinten ${b.suspension.travelRearMm} mm` : null].filter(Boolean).join(' · ') : null),
  motor: (b) => (b.motor ? [b.motor.brand, b.motor.name, b.motor.powerW ? `${b.motor.powerW} W` : null, b.motor.torqueNm ? `${b.motor.torqueNm} Nm` : null].filter(Boolean).join(' · ') || null : null),
  battery: (b) => (b.battery?.wh ? `${b.battery.wh} Wh${b.battery.removable == null ? '' : b.battery.removable ? ' · herausnehmbar' : ' · integriert'}` : null),
};

const tag = (text, kind) => h('span', { class: `tag ${kind}` }, text);
const unknown = h.bind(null, 'span', { class: 'unk' }, 'nicht verifiziert');
const row = (label, val) => h('div', { class: 'spec' }, h('dt', null, label), h('dd', null, val ?? unknown()));

export function placeholderImg() {
  return h('div', { class: 'img-ph', 'aria-hidden': 'true' }, h('svg', { viewBox: '0 0 64 40', width: 64, height: 40 },
    h('circle', { cx: 14, cy: 28, r: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }), h('circle', { cx: 50, cy: 28, r: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })));
}

function image(b) {
  if (!b.imageUrl) return h('div', { class: 'img' }, placeholderImg());
  const wrap = h('div', { class: 'img' });
  const img = h('img', { src: b.imageUrl, alt: `${b.brand} ${b.model}`, loading: 'lazy', referrerPolicy: 'no-referrer', onError: () => { wrap.replaceChildren(placeholderImg()); } });
  wrap.append(img); return wrap;
}

const syncDuplicates = (id) => {
  // Dasselbe Rad kann mehrfach auf der Seite stehen (Tipp + Trefferliste): Zustände angleichen
  const inCmp = compare.list().includes(id), inWl = wishlist.has(id);
  document.querySelectorAll(`input[data-cmp="${CSS.escape(id)}"]`).forEach((i) => { i.checked = inCmp; });
  document.querySelectorAll(`button[data-wl="${CSS.escape(id)}"]`).forEach((btn) => {
    btn.classList.toggle('on', inWl); btn.textContent = inWl ? '♥ Gemerkt' : '♡ Merken'; btn.setAttribute('aria-pressed', String(inWl));
  });
};

export function actions(b) {
  const inWl = wishlist.has(b.id), inCmp = compare.list().includes(b.id);
  return h('div', { class: 'card-actions' },
    h('button', { class: `btn ghost small${inWl ? ' on' : ''}`, type: 'button', 'aria-pressed': String(inWl), dataset: { wl: b.id }, onClick: () => { wishlist.toggle(b); syncDuplicates(b.id); } }, inWl ? '♥ Gemerkt' : '♡ Merken'),
    h('label', { class: 'cmp' }, h('input', { type: 'checkbox', checked: inCmp, dataset: { cmp: b.id }, onChange: (e) => { if (!compare.toggle(b.id)) alert('Maximal 4 Fahrräder vergleichbar.'); syncDuplicates(b.id); } }), ' Vergleichen'),
    h('a', { class: 'btn primary small', href: b.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, `Zum Angebot${b.retailer ? ' bei ' + b.retailer : ''} ↗`));
}

export function bikeCard(b, ctx = {}) {
  const m = b.match;
  const [vLabel, vKind] = VERDICT[m.verdict];
  const [pLabel, pKind] = VERIF[b.verification.status] ?? VERIF.unverified;
  const price = b.price.amount;
  const frame = ctx.frameRec ? `Empfehlung ${ctx.frameRec.letter}${ctx.frameRec.cm ? ` (≈ ${ctx.frameRec.cm} cm)` : ''}` : null;
  const best = (m.criteria ?? []).filter((c) => c.score != null && c.score >= 85).map((c) => c.label);
  const weak = (m.criteria ?? []).filter((c) => c.score != null && c.score < 55).map((c) => c.label);
  return h('article', { class: `bike-card verdict-${m.verdict}`, id: `bike-${b.id}` },
    h('div', { class: 'bike-top' }, image(b),
      h('div', { class: 'bike-head' },
        h('div', { class: 'tags' }, ctx.badge ? tag(ctx.badge, 'brand') : null, tag(vLabel, vKind), tag(pLabel, pKind)),
        h('h3', null, h('span', { class: 'brandname' }, b.brand), ' ', b.model),
        h('p', { class: 'meta' }, [b.year ? `Modelljahr ${b.year}` : 'Modelljahr unbekannt', TYPE_LABEL[b.type], DRIVES[b.drive], b.condition === 'used' ? 'gebraucht' : null].filter(Boolean).join(' · ')),
        h('div', { class: 'price-row' },
          h('span', { class: 'price' }, price != null ? fmtEUR(price) : 'Preis unbekannt'),
          b.price.listPrice && b.price.discountPct ? h('span', { class: 'was' }, `${fmtEUR(b.price.listPrice)} · −${Math.round(b.price.discountPct)} %`) : null,
          b.price.asOf ? h('span', { class: 'asof' }, `Stand ${b.price.asOf}`) : null)),
      h('div', { class: 'score', title: 'Matching-Score' },
        h('div', { class: `ring ${vKind}`, style: `--p:${m.score}` }, h('span', null, `${m.score}%`)),
        h('small', null, 'Match'))),
    h('dl', { class: 'specs' },
      row('Rahmengröße', b.frameSizes?.length ? `${b.frameSizes.join(', ')}${frame ? ' – ' + frame : ''}` : (frame ? `${frame} – Verfügbarkeit nicht verifiziert` : null)),
      row('Gewicht', b.weightKg ? `${b.weightKg} kg` : null),
      b.drive !== 'classic' ? row('Motor', specText.motor(b)) : null,
      b.drive !== 'classic' ? row('Akku', specText.battery(b)) : null,
      b.drive !== 'classic' ? row('Reichweite (geschätzt)', m.estimatedRange ? `≈ ${m.estimatedRange} km für dein Profil` : null) : null,
      row('Schaltung', specText.drivetrain(b)), row('Bremsen', specText.brakes(b)), row('Federung', specText.suspension(b))),
    b.highlights?.length ? h('ul', { class: 'highlights' }, b.highlights.map((x) => h('li', null, x))) : null,
    h('section', { class: 'why' },
      h('h4', null, 'Warum dieses Rad?'),
      h('p', null, best.length ? `Besonders gut: ${best.join(', ')}.` : 'Keine Kategorie überzeugt voll – ein Kompromiss.'),
      weak.length ? h('p', null, `Schwächen: ${weak.join(', ')}.`) : null,
      m.fails.length ? h('div', { class: 'callout bad' }, h('strong', null, 'Nicht erfüllt: '), h('ul', null, m.fails.map((f) => h('li', null, f.text)))) : null,
      m.unknowns.length ? h('div', { class: 'callout warn' }, h('strong', null, 'Nicht verifiziert: '), h('ul', null, m.unknowns.map((f) => h('li', null, f.text)))) : null,
      b.betterAlternativeId ? h('p', null, 'Bessere Alternative im Budget: ', h('a', { href: `#bike-${b.betterAlternativeId}`, onClick: (e) => { e.preventDefault(); document.getElementById(`bike-${b.betterAlternativeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, 'siehe Treffer')) : null),
    (b.pros?.length || b.cons?.length) ? h('div', { class: 'proscons' },
      h('ul', { class: 'pros' }, b.pros.map((x) => h('li', null, x))), h('ul', { class: 'cons' }, b.cons.map((x) => h('li', null, x)))) : null,
    h('details', { class: 'breakdown' }, h('summary', null, `Bewertung im Detail · Datenvertrauen ${m.confidence} %`),
      h('table', null, h('tbody', null, m.criteria.map((c) => h('tr', null,
        h('th', { scope: 'row' }, c.label), h('td', { class: 'bar-cell' }, h('div', { class: 'mini-bar' }, h('i', { style: `width:${c.score ?? 0}%` }))),
        h('td', null, c.score == null ? '?' : `${c.score}`), h('td', { class: 'notes' }, (c.notes ?? []).join('; ')))))),
      h('p', { class: 'src' }, 'Quellen: ', b.verification.sources.map((s, i) => [i ? ', ' : '', h('a', { href: s, target: '_blank', rel: 'noopener noreferrer nofollow' }, new URL(s).hostname)]), b.verification.note ? ` · ${b.verification.note}` : '', b.verification.unverifiedFields?.length ? ` · Nicht verifiziert: ${b.verification.unverifiedFields.join(', ')}` : '')),
    actions(b));
}
