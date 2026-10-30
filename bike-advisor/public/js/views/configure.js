import { h, mount, toast } from '../dom.js';
import { draft, saved } from '../store.js';
import { visibleSteps, stepErrors, fieldVisible, defaultAnswers } from '/shared/questionnaire.js';
import { setPath } from '/shared/util.js';
import { renderField } from '../components/fields.js';
import { stepper } from '../components/stepper.js';
import { api } from '../api.js';

let brandsCache = null;

export async function configureView(root, nav) {
  const state = draft.get();
  let { answers, step } = state;
  let maxReached = Math.max(step, Number(sessionStorage.getItem('konfirad.max') ?? step));
  brandsCache ??= await api.brands().then((r) => r.brands).catch(() => null);
  const ctx = { brands: brandsCache ?? ['Cube', 'Trek', 'Specialized', 'Canyon'] };
  let showErrors = false;

  const persist = () => { draft.set(answers, step); try { sessionStorage.setItem('konfirad.max', String(maxReached)); } catch { /* ignore */ } };

  function onChange(field, value, silent) {
    setPath(answers, field.id, value);
    persist();
    if (!silent) render();
  }

  function go(i) { step = Math.max(0, Math.min(i, visibleSteps(answers).length - 1)); maxReached = Math.max(maxReached, step); persist(); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function render() {
    const steps = visibleSteps(answers);
    if (step >= steps.length) step = steps.length - 1;
    const cur = steps[step];
    const errors = stepErrors(cur, answers);
    const last = step === steps.length - 1;
    mount(root,
      h('div', { class: 'container narrow' },
        stepper(steps, step, go, maxReached),
        h('section', { class: 'panel', key: cur.id },
          h('h2', null, cur.title), h('p', { class: 'subtitle' }, cur.subtitle),
          showErrors && errors.length ? h('div', { class: 'callout bad', role: 'alert' }, errors.map((e) => h('div', null, e.message))) : null,
          cur.fields.filter((f) => fieldVisible(f, answers)).map((f) => renderField(f, answers, onChange, ctx))),
        h('div', { class: 'wizard-nav' },
          h('button', { class: 'btn ghost', type: 'button', disabled: step === 0, onClick: () => go(step - 1) }, '← Zurück'),
          h('button', { class: 'btn ghost small', type: 'button', onClick: () => { const name = prompt('Name für diese Suche:', 'Meine Fahrradsuche'); if (name !== null) { saved.add(name, answers, step); toast('Suche gespeichert'); } } }, 'Speichern'),
          last
            ? h('button', { class: 'btn primary', type: 'button', onClick: () => { const all = steps.flatMap((s) => stepErrors(s, answers)); if (all.length) { showErrors = true; const idx = steps.findIndex((s) => stepErrors(s, answers).length); go(idx); return; } nav('#/results?run=1'); } }, 'Fahrräder finden →')
            : h('button', { class: 'btn primary', type: 'button', onClick: () => { if (errors.length) { showErrors = true; render(); return; } showErrors = false; go(step + 1); } }, 'Weiter →'))));
    root.querySelector('.panel')?.classList.add('enter');
  }
  render();
}

export function loadSaved(entry) { draft.set({ ...defaultAnswers(), ...entry.answers }, entry.step ?? 0); }
