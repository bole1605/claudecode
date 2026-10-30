// Geräteübergreifende Ablage (Wunschliste, gespeicherte Suchen, Entwurf, Ergebnisse) als JSON-Datei auf dem Rechner, auf dem KonfiRad läuft.
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

const KEYS = ['draft', 'saved', 'wishlist', 'brands', 'results'];
export const MAX_BYTES = 2_000_000;

export class UserStore {
  constructor(file) { this.file = file; this.chain = Promise.resolve(); }

  async read() {
    try { return JSON.parse(await readFile(this.file, 'utf8')); } catch { return { updatedAt: 0, data: {} }; }
  }

  /** Nur bekannte Schlüssel, grobe Typprüfung; Gesamtgröße begrenzt. */
  static sanitize(input) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw Object.assign(new Error('Ungültige Daten'), { status: 422 });
    const data = {};
    for (const k of KEYS) {
      const v = input[k]; if (v === undefined) continue;
      const okType = k === 'saved' || k === 'wishlist' || k === 'brands' ? Array.isArray(v) : (v === null || typeof v === 'object');
      if (!okType) throw Object.assign(new Error(`Ungültiger Typ für ${k}`), { status: 422 });
      data[k] = v;
    }
    if (JSON.stringify(data).length > MAX_BYTES) throw Object.assign(new Error('Daten zu groß'), { status: 413 });
    return data;
  }

  /** Letzter Schreiber gewinnt; Schreibvorgänge werden serialisiert und atomar (tmp + rename) ausgeführt. */
  write(input, updatedAt = Date.now()) {
    const data = UserStore.sanitize(input);
    const job = this.chain.then(async () => {
      const cur = await this.read();
      const next = { updatedAt, data: { ...cur.data, ...data } };
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      await writeFile(tmp, JSON.stringify(next)); await rename(tmp, this.file);
      return next;
    });
    this.chain = job.catch(() => {});
    return job;
  }
}
