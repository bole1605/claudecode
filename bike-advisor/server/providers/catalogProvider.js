// Provider 1: lokaler, kuratierter Katalog (JSON-Dateien in data/catalog). Enthält ausschließlich vom Betreiber verifizierte Daten.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeBike } from '../../shared/bikeSchema.js';

const STALE_DAYS = 60;

export class CatalogProvider {
  id = 'catalog';
  label = 'Kuratierter Katalog';
  constructor(config) { this.dir = config.catalogDir; this.cache = null; }

  async load() {
    let files = [];
    try { files = (await readdir(this.dir)).filter((f) => f.endsWith('.json')); } catch { return { bikes: [], rejected: 0 }; }
    const bikes = []; let rejected = 0;
    for (const f of files) {
      let data;
      try { data = JSON.parse(await readFile(path.join(this.dir, f), 'utf8')); } catch { rejected++; continue; }
      for (const raw of Array.isArray(data) ? data : data.bikes ?? []) {
        const lastVerified = typeof raw.lastVerified === 'string' ? raw.lastVerified : null;
        const { ok, bike } = normalizeBike(raw, { provider: this.id, retrievedAt: lastVerified ?? undefined });
        if (!ok || !lastVerified || Number.isNaN(Date.parse(lastVerified))) { rejected++; continue; }
        const ageDays = (Date.now() - Date.parse(lastVerified)) / 864e5;
        bike.verification.status = ageDays <= STALE_DAYS ? 'verified' : 'stale';
        bike.verification.lastVerified = lastVerified;
        bikes.push(bike);
      }
    }
    return { bikes, rejected };
  }

  async isAvailable() {
    const { bikes } = await this.load();
    return bikes.length > 0 ? { ok: true } : { ok: false, reason: 'Katalog ist leer (data/catalog/*.json mit verifizierten Modellen befüllen)' };
  }

  async search(spec) {
    const { bikes, rejected } = await this.load();
    const ok = bikes.filter((b) => (!spec.driveStrict || !spec.drive || b.drive === spec.drive));
    return { bikes: ok, notes: rejected ? [`${rejected} Katalogeinträge wegen fehlender Pflichtfelder/Verifizierungsdatum verworfen.`] : [] };
  }
}
