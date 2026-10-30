import { h, mount } from '../dom.js';
import { draft, results } from '../store.js';

export function homeView(root) {
  const d = draft.get();
  const hasDraft = JSON.stringify(d.answers.category ?? '') !== '""' && d.answers.category;
  mount(root,
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'Unabhängige Fahrrad-Kaufberatung'),
      h('h1', null, 'Finde das Fahrrad, das wirklich zu dir passt.'),
      h('p', { class: 'lead' }, 'Beantworte ein paar gezielte Fragen. Wir durchsuchen aktuelle Herstellerseiten und Händler, bewerten jedes Modell transparent und erklären dir, warum es passt – oder warum nicht.'),
      h('div', { class: 'cta' },
        h('a', { class: 'btn primary large', href: '#/configure', onClick: () => { if (hasDraft) return; draft.reset(); } }, hasDraft ? 'Konfiguration fortsetzen' : 'Konfiguration starten'),
        hasDraft ? h('a', { class: 'btn ghost large', href: '#/configure', onClick: () => draft.reset() }, 'Neu beginnen') : null,
        results.get() ? h('a', { class: 'btn ghost large', href: '#/results' }, 'Letzte Ergebnisse') : null)),
    h('section', { class: 'features' }, [
      ['7 Schritte, dynamisch', 'Nur relevante Fragen – Motor- und Akkufragen erscheinen nur bei E-Bikes.'],
      ['Echte Modelle, echte Quellen', 'Keine erfundenen Daten. Jedes Modell verlinkt auf Hersteller/Händler; Unverifiziertes wird markiert.'],
      ['Transparenter Score', 'Muss-Kriterien und Wünsche getrennt. Ein verfehltes Muss-Kriterium kann nie „perfekt“ sein.'],
      ['Vergleichen & merken', '2–4 Räder direkt vergleichen, Wunschliste und Suchen speichern.'],
    ].map(([t, p]) => h('div', { class: 'feature' }, h('h3', null, t), h('p', null, p)))));
}
