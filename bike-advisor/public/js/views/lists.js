import { h, mount, toast } from '../dom.js';
import { saved, wishlist, compare, exportJson, draft } from '../store.js';
import { bikeCard } from '../components/bikeCard.js';
import { loadSaved } from './configure.js';
import { validateAnswers } from '/shared/validate.js';

export function wishlistView(root, nav) {
  const list = wishlist.list();
  mount(root, h('div', { class: 'container' },
    h('div', { class: 'results-head' }, h('h2', null, `Wunschliste (${list.length})`),
      list.length >= 2 ? h('button', { class: 'btn primary small', type: 'button', onClick: () => { compare.clear(); list.slice(0, 4).forEach((b) => compare.toggle(b.id)); nav('#/compare'); } }, 'Die ersten 4 vergleichen') : null),
    list.length ? h('p', { class: 'help' }, 'Gespeicherte Daten sind ein Schnappschuss – Preise und Verfügbarkeit können sich geändert haben.') : h('p', null, 'Noch nichts gemerkt. Über „♡ Merken“ in den Ergebnissen landen Fahrräder hier.'),
    h('div', { class: 'grid' }, list.map((b) => h('div', null, bikeCard(b, {}), h('p', { class: 'help' }, `Gemerkt am ${new Date(b.savedAt).toLocaleDateString('de-DE')}`))))));
}

export function savedView(root, nav) {
  const list = saved.list();
  const fileInput = h('input', { type: 'file', accept: 'application/json', hidden: true, onChange: async (e) => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const v = validateAnswers(data.answers);
      if (!v.ok) throw new Error(v.errors[0]);
      saved.add(data.name ?? 'Importierte Suche', v.answers, data.step ?? 0); toast('Suche importiert'); savedView(root, nav);
    } catch (err) { toast(`Import fehlgeschlagen: ${err.message}`); }
  } });
  mount(root, h('div', { class: 'container narrow' }, h('h2', null, 'Gespeicherte Suchen'),
    list.length ? null : h('p', null, 'Noch keine gespeicherte Suche. Im Konfigurator kannst du jederzeit „Speichern“ wählen.'),
    h('ul', { class: 'saved-list' }, list.map((s) => h('li', { class: 'panel' },
      h('div', null, h('strong', null, s.name), h('small', null, ` · ${new Date(s.savedAt).toLocaleString('de-DE')}`)),
      h('div', { class: 'cta' },
        h('button', { class: 'btn primary small', type: 'button', onClick: () => { loadSaved(s); nav('#/configure'); } }, 'Fortsetzen'),
        h('button', { class: 'btn ghost small', type: 'button', onClick: () => exportJson(s, `radwerk-${s.name.replace(/\W+/g, '-')}.json`) }, 'Exportieren'),
        h('button', { class: 'btn ghost small', type: 'button', onClick: () => { saved.remove(s.id); savedView(root, nav); } }, 'Löschen'))))),
    h('button', { class: 'btn ghost', type: 'button', onClick: () => fileInput.click() }, 'Suche importieren (JSON)'), fileInput));
}
export { draft };
