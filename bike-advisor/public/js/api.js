const pin = { get: () => { try { return localStorage.getItem('konfirad.pin') ?? ''; } catch { return ''; } }, set: (v) => { try { localStorage.setItem('konfirad.pin', v); } catch { /* ignore */ } } };

async function request(path, opts, retry = true) {
  let res;
  try { res = await fetch(path, { headers: { 'content-type': 'application/json', 'x-app-pin': pin.get() }, ...opts }); }
  catch { throw new Error('Server nicht erreichbar. Bitte Verbindung prüfen.'); }
  if (res.status === 401 && retry) {
    const entered = prompt('Dieser KonfiRad-Server ist per PIN geschützt. PIN eingeben:');
    if (entered) { pin.set(entered); return request(path, opts, false); }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error ?? `Fehler ${res.status}`); e.details = data.details; e.status = res.status; throw e; }
  return data;
}
export const api = {
  health: () => request('/api/health'),
  getStore: () => request('/api/store'),
  putStore: (data, updatedAt) => request('/api/store', { method: 'PUT', body: JSON.stringify({ data, updatedAt }) }),
  brands: () => request('/api/brands'),
  startSearch: (answers) => request('/api/search', { method: 'POST', body: JSON.stringify({ answers }) }),
  pollSearch: (id) => request(`/api/search/${id}`),
  ask: (question, answers, history) => request('/api/advisor', { method: 'POST', body: JSON.stringify({ question, answers, history }) }),
};

/** Startet eine Suche und pollt bis zum Ergebnis. */
export async function runSearch(answers, onProgress, signal) {
  const { jobId } = await api.startSearch(answers);
  for (let i = 0; i < 400; i++) {
    if (signal?.aborted) throw new DOMException('abgebrochen', 'AbortError');
    const r = await api.pollSearch(jobId);
    onProgress?.(r.progress ?? []);
    if (r.status === 'done') return r.result;
    if (r.status === 'error') throw new Error(r.error ?? 'Suche fehlgeschlagen');
    await new Promise((res) => setTimeout(res, 1500));
  }
  throw new Error('Zeitüberschreitung bei der Suche');
}
