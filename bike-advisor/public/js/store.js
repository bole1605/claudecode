// Persistenz im Browser (localStorage) hinter einer kleinen Schnittstelle – später durch Server/Account-Speicher ersetzbar.
import { defaultAnswers } from '/shared/questionnaire.js';

const KEYS = { draft: 'radwerk.draft', saved: 'radwerk.saved', wishlist: 'radwerk.wishlist', brands: 'radwerk.brands', results: 'radwerk.results' };
const read = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export const draft = {
  get() { const d = read(KEYS.draft, null); return d ? { answers: { ...defaultAnswers(), ...d.answers }, step: d.step ?? 0 } : { answers: defaultAnswers(), step: 0 }; },
  set(answers, step) { write(KEYS.draft, { answers, step }); emit(); },
  reset() { try { localStorage.removeItem(KEYS.draft); localStorage.removeItem(KEYS.results); } catch { /* ignore */ } emit(); },
};

export const results = { get: () => read(KEYS.results, null), set: (r) => write(KEYS.results, r) };

export const saved = {
  list: () => read(KEYS.saved, []),
  add(name, answers, step) {
    const list = saved.list();
    list.unshift({ id: crypto.randomUUID(), name: name.slice(0, 60) || 'Meine Suche', savedAt: new Date().toISOString(), answers, step });
    write(KEYS.saved, list.slice(0, 30)); emit();
  },
  remove(id) { write(KEYS.saved, saved.list().filter((s) => s.id !== id)); emit(); },
};

export const wishlist = {
  list: () => read(KEYS.wishlist, []),
  has: (id) => wishlist.list().some((b) => b.id === id),
  toggle(bike) {
    const list = wishlist.list();
    const i = list.findIndex((b) => b.id === bike.id);
    if (i >= 0) list.splice(i, 1); else list.push({ ...bike, savedAt: new Date().toISOString() });
    write(KEYS.wishlist, list); emit();
    return i < 0;
  },
};

export const customBrands = {
  list: () => read(KEYS.brands, []),
  add(name) { const l = new Set(customBrands.list()); l.add(name.trim().slice(0, 40)); write(KEYS.brands, [...l]); emit(); },
};

// Auswahl für den Vergleich (2–4), nur im Speicher der Sitzung
const compareIds = [];
export const compare = {
  list: () => [...compareIds],
  toggle(id) {
    const i = compareIds.indexOf(id);
    if (i >= 0) compareIds.splice(i, 1);
    else if (compareIds.length < 4) compareIds.push(id); else return false;
    emit(); return true;
  },
  clear() { compareIds.length = 0; emit(); },
};

export function exportJson(obj, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click(); URL.revokeObjectURL(url);
}
