import { h, mount, toast } from '../dom.js';
import { draft, results, compare } from '../store.js';
import { runSearch } from '../api.js';
import { bikeCard } from '../components/bikeCard.js';
import { frameAdvice, batteryAdvice } from '/shared/derive.js';
import { fmtEUR } from '/shared/util.js';

let running = null;

function loading(root, lines) {
  mount(root, h('div', { class: 'container narrow center' },
    h('div', { class: 'spinner', 'aria-hidden': 'true' }),
    h('h2', null, 'Wir durchsuchen den Markt …'),
    h('p', { class: 'help' }, 'Aktuelle Herstellerseiten und Händler werden geprüft. Das kann bis zu einer Minute dauern.'),
    h('ul', { class: 'progress-log', 'aria-live': 'polite' }, lines.slice(-5).map((l) => h('li', null, l)))));
}

function unavailable(root, r) {
  mount(root, h('div', { class: 'container narrow' }, h('div', { class: 'panel' },
    h('h2', null, 'Keine Datenquelle verfügbar'),
    h('p', null, 'Es wurden bewusst keine Ergebnisse simuliert. Damit die Suche echte, aktuelle Modelle findet, muss mindestens eine Quelle aktiv sein:'),
    h('ul', null, (r.providers ?? []).map((p) => h('li', null, h('strong', null, p.label), ': ', p.ok ? 'verfügbar' : p.reason))),
    h('p', { class: 'help' }, 'Siehe README → „Datenquellen einrichten“.'),
    h('a', { class: 'btn ghost', href: '#/configure' }, '← Zurück zum Konfigurator'))));
}

export function renderResults(root, r, answers, nav) {
  if (r.unavailable) return unavailable(root, r);
  const frame = frameAdvice(answers)?.rec;
  const bat = batteryAdvice(answers);
  const sections = [];
  sections.push(h('div', { class: 'results-head' },
    h('div', null, h('h2', null, r.results.length ? `${r.results.length} passende Fahrräder` : 'Keine passenden Fahrräder gefunden'),
      h('p', { class: 'help' }, `Geprüfte Modelle: ${r.total}${r.searchedAt ? ` · Stand ${new Date(r.searchedAt).toLocaleString('de-DE')}` : ''}. Preise und Verfügbarkeit bitte beim Händler prüfen.`)),
    h('div', { class: 'cta' }, h('a', { class: 'btn ghost small', href: '#/configure' }, 'Antworten ändern'), h('button', { class: 'btn ghost small', type: 'button', onClick: () => nav('#/results?run=1') }, 'Neu suchen'))));
  if (frame) sections.push(h('div', { class: 'insight' }, h('strong', null, `Deine Größe: ${frame.letter}${frame.cm ? ` (≈ ${frame.cm} cm)` : ''}`), h('p', null, frame.geometry)));
  if (bat && answers.category !== 'classic') sections.push(h('div', { class: 'insight' }, h('strong', null, bat.title), h('p', null, bat.text)));
  for (const n of r.notes ?? []) sections.push(h('div', { class: 'callout warn' }, n));

  if (!r.alternatives?.hasPerfect && r.results.length) {
    sections.push(h('div', { class: 'callout warn' }, h('strong', null, 'Kein Modell erfüllt alle Muss-Kriterien. '), 'Mögliche Kompromisse:',
      h('ul', null, (r.alternatives.compromises ?? []).map((c) => h('li', null, h('strong', null, c.name), ` (${c.score} %): ${c.tradeoffs.join('; ')}.`)))));
  }
  const picks = [];
  if (r.valuePick) picks.push(bikeCard(r.valuePick.bike, { badge: '💡 Preis-Leistungs-Tipp', frameRec: frame }));
  if (r.premiumPick) picks.push(bikeCard(r.premiumPick.bike, { badge: '⭐ Premium-Empfehlung (über Budget)', frameRec: frame }));
  if (picks.length) sections.push(h('h3', { class: 'section-title' }, 'Unsere Tipps'), h('div', { class: 'grid' }, picks));
  if (r.results.length) sections.push(h('h3', { class: 'section-title' }, 'Beste Treffer'), h('div', { class: 'grid' }, r.results.map((b) => bikeCard(b, { frameRec: frame }))));
  mount(root, h('div', { class: 'container' }, sections));
}

export async function resultsView(root, nav, params) {
  const answers = draft.get().answers;
  if (params.get('run')) {
    if (running) return loading(root, running.lines);
    const lines = ['Suche wird vorbereitet …'];
    running = { lines };
    loading(root, lines);
    try {
      const r = await runSearch(answers, (p) => { running.lines = p; loading(root, p); });
      results.set({ result: r, answers });
      compare.clear();
      running = null;
      history.replaceState(null, '', '#/results');
      return renderResults(root, r, answers, nav);
    } catch (e) {
      running = null;
      const detail = e.details ? ` (${e.details.join('; ')})` : '';
      return mount(root, h('div', { class: 'container narrow' }, h('div', { class: 'panel' }, h('h2', null, 'Suche fehlgeschlagen'), h('div', { class: 'callout bad', role: 'alert' }, e.message + detail),
        h('div', { class: 'cta' }, h('button', { class: 'btn primary', type: 'button', onClick: () => nav('#/results?run=1') }, 'Erneut versuchen'), h('a', { class: 'btn ghost', href: '#/configure' }, 'Antworten prüfen')))));
    }
  }
  const stored = results.get();
  if (!stored) return mount(root, h('div', { class: 'container narrow' }, h('div', { class: 'panel' }, h('h2', null, 'Noch keine Ergebnisse'), h('p', null, 'Starte zuerst den Konfigurator.'), h('a', { class: 'btn primary', href: '#/configure' }, 'Zum Konfigurator'))));
  renderResults(root, stored.result, stored.answers, nav);
}
export { fmtEUR, toast };
