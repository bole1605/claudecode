import { createHash, randomUUID } from 'node:crypto';
import { buildSpec } from '../../shared/spec.js';
import { scoreBike } from '../../shared/scoring.js';

const TOP_N = 10;

/** Bewertet, sortiert und reichert Ergebnisse an (Preis-Leistungs-Tipp, Premium, Alternativen, Kompromisse). */
export function rankBikes(bikes, answers) {
  const spec = buildSpec(answers);
  const scored = bikes.map((bike) => ({ bike, match: scoreBike(bike, spec) }));
  scored.sort((a, b) => b.match.score - a.match.score || (a.bike.price.amount ?? 1e9) - (b.bike.price.amount ?? 1e9));
  const results = scored.slice(0, TOP_N).map((r, i) => ({ ...r.bike, match: r.match, rank: i + 1 }));

  const clean = scored.filter((r) => r.match.fails.length === 0);
  const valuePool = clean.filter((r) => r.match.score >= 60 && r.bike.price.amount != null);
  const valueBike = valuePool.sort((a, b) => ((b.match.criteria.find((c) => c.key === 'value')?.score ?? 50) * 0.5 + b.match.score * 0.5) - ((a.match.criteria.find((c) => c.key === 'value')?.score ?? 50) * 0.5 + a.match.score * 0.5))[0];

  const premium = bikes.map((bike) => ({ bike, match: scoreBike(bike, spec, { ignoreBudget: true }) }))
    .filter((r) => r.match.fails.length === 0 && r.match.score >= 60 && spec.budget.max != null && (r.bike.price.amount ?? 0) > spec.budget.max)
    .sort((a, b) => b.match.score - a.match.score)[0];

  // Bessere Alternative im Budget je Treffer
  for (const r of results) {
    const alt = results.find((o) => o.id !== r.id && o.match.score > r.match.score + 3 && (spec.budget.max == null || (o.price.amount ?? 0) <= spec.budget.max * 1.05));
    r.betterAlternativeId = alt?.id ?? null;
  }

  const alternatives = { hasPerfect: clean.some((r) => r.match.verdict === 'excellent' || r.match.verdict === 'good'), compromises: [] };
  if (!alternatives.hasPerfect) {
    for (const r of scored.filter((x) => x.match.fails.length >= 1).slice(0, 3)) {
      alternatives.compromises.push({
        id: r.bike.id, name: `${r.bike.brand} ${r.bike.model}`, score: r.match.score,
        tradeoffs: r.match.fails.map((f) => f.text),
        advice: `Wenn du bei „${r.match.fails[0].text}“ Kompromisse eingehst, wäre dieses Modell eine Option (rohe Passung ${r.match.rawScore} %).`,
      });
    }
  }
  const pick = (r) => (r ? { id: r.bike.id, bike: { ...r.bike, match: r.match } } : null);
  return { results, valuePick: pick(valueBike), premiumPick: pick(premium), alternatives, spec: { budget: spec.budget, drive: spec.drive, whRecommended: spec.battery?.whRecommended ?? null }, total: bikes.length };
}

/** Orchestriert Provider, Cache und asynchrone Suchjobs. */
export class SearchService {
  constructor(providers, config) {
    this.providers = providers; this.cfg = config;
    this.cache = new Map(); this.jobs = new Map();
  }

  async status() {
    return Promise.all(this.providers.map(async (p) => ({ id: p.id, label: p.label, ...(await p.isAvailable()) })));
  }

  cacheKey(spec) {
    // Nur suchrelevante Teile – Scoring-Details ändern das Rohangebot nicht
    const { uses, drive, budget, condition, brandsPreferred, brandsExcluded, motor, battery, equipment, features } = spec;
    return createHash('sha1').update(JSON.stringify({ uses, drive, budget, condition, brandsPreferred, brandsExcluded, motor, battery: battery?.whMin, eq: { ...equipment, must: [...equipment.must] }, features })).digest('hex');
  }

  start(answers) {
    const id = randomUUID();
    const job = { id, status: 'running', progress: ['Suche gestartet …'], createdAt: Date.now(), result: null, error: null };
    this.jobs.set(id, job);
    this.run(job, answers).catch((e) => { job.status = 'error'; job.error = e.message; });
    for (const [k, j] of this.jobs) if (Date.now() - j.createdAt > 3_600_000) this.jobs.delete(k);
    return job;
  }

  async run(job, answers) {
    const spec = buildSpec(answers);
    const key = this.cacheKey(spec);
    const hit = this.cache.get(key);
    let raw;
    if (hit && Date.now() - hit.at < this.cfg.cacheTtlMs) {
      raw = hit.raw; job.progress.push('Ergebnis aus Cache (Preise können sich geändert haben).');
    } else {
      const statuses = await this.status();
      const active = this.providers.filter((p, i) => statuses[i].ok);
      if (!active.length) {
        job.status = 'done';
        job.result = { results: [], unavailable: true, providers: statuses, notes: ['Keine Datenquelle verfügbar. Es werden bewusst keine Ergebnisse simuliert.'], total: 0 };
        return;
      }
      const all = new Map(); const notes = [];
      await Promise.all(active.map(async (p) => {
        job.progress.push(`${p.label}: suche …`);
        try {
          const r = await p.search(spec, { onProgress: (m) => job.progress.push(`${p.label}: ${m}`) });
          notes.push(...r.notes);
          for (const b of r.bikes) { const prev = all.get(b.id); if (!prev || b.verification.status === 'verified') all.set(b.id, b); }
        } catch (e) { notes.push(`${p.label} fehlgeschlagen: ${e.message}`); }
      }));
      raw = { bikes: [...all.values()], notes, providers: statuses, searchedAt: new Date().toISOString() };
      if (raw.bikes.length) this.cache.set(key, { at: Date.now(), raw });
    }
    job.result = { ...rankBikes(raw.bikes, answers), notes: raw.notes, providers: raw.providers, searchedAt: raw.searchedAt };
    job.status = 'done';
  }
}
