// Provider 2: Live-Websuche über die Anthropic Messages API (Server-Tool web_search).
// Anti-Halluzination: Das Modell darf nur Daten aus gefundenen Seiten übernehmen; Produkt-URLs werden gegen die tatsächlich
// abgerufenen Suchtreffer geprüft. Nicht bestätigte Modelle werden als „unverified“ markiert (nie als verifiziert ausgegeben).
import { normalizeBike } from '../../shared/bikeSchema.js';
import { TYPE_LABEL, DRIVES } from '../../shared/taxonomy.js';

const API = 'https://api.anthropic.com/v1/messages';

const SCHEMA_HINT = `{"bikes":[{"brand":"","model":"","year":2026,"type":"mtb|emtb|trekking|etrekking|city|ecity|gravel|road|cross|fitness|cargo|touring|commute|allround","drive":"ebike|classic|speed","condition":"new|used","url":"Produktseite","retailer":"","imageUrl":"direkte Bild-URL oder null","price":{"amount":0,"listPrice":0,"discountPct":0,"asOf":"YYYY-MM-DD"},"frameSizes":["S","M"],"weightKg":0,"maxSystemWeightKg":0,"material":"aluminium|carbon|steel","frameShape":"diamond|trapeze|lowstep","motor":{"brand":"","name":"","powerW":0,"torqueNm":0,"concept":"mid|rear|front"},"battery":{"wh":0,"removable":true,"extenderSupport":false,"chargeHours":0},"drivetrain":{"type":"chain|hub|electronic","gears":0,"brand":"","name":""},"brakes":{"type":"hydraulic|mechanical|rim","name":""},"suspension":{"type":"none|fork|full","travelFrontMm":0,"travelRearMm":0},"tires":{"widthMm":0},"features":{"rack":true,"fenders":true,"lights":true,"kickstand":true,"stand":false,"lock":false,"luggageMounts":true,"kidSeat":false,"trailer":true,"tubeless":false,"comfortSaddle":false,"ergoGrips":false},"highlights":[""],"warranty":"","pros":[""],"cons":[""],"sources":["URLs"]}]}`;

const SYSTEM = `Du bist Recherche-Assistent einer unabhängigen Fahrrad-Kaufberatung. Du nutzt ausschließlich das Werkzeug web_search und übernimmst nur Informationen, die auf den gefundenen Seiten (Herstellerseiten, seriöse Händler) tatsächlich stehen.
Strikte Regeln:
- Erfinde NIE Modelle, technische Daten, Preise, Rabatte, Bild-URLs oder Verfügbarkeiten. Unbekannte Felder = null (oder Feld weglassen).
- "url" muss die konkrete Produktseite des Modells sein, die du gefunden hast. Ohne gefundene Produktseite das Modell weglassen.
- Bevorzuge aktuelle Modelljahre und Preise (Preisstand "asOf" angeben). Rabatt nur, wenn Streichpreis und Angebotspreis auf der Seite stehen.
- Preise in EUR (Deutschland). Technische Daten aus der Herstellerangabe.
- Antworte am Ende ausschließlich mit einem JSON-Objekt (kein Fließtext) im Format: ${SCHEMA_HINT}`;

const normUrl = (u) => { try { const x = new URL(u); return (x.origin + x.pathname).replace(/\/$/, '').toLowerCase(); } catch { return null; } };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return null; } };

export function buildPrompt(spec, focusUse, brandsPool) {
  const b = spec.budget;
  const lines = [
    `Suche aktuell verfügbare, real existierende Fahrradmodelle (${DRIVES[spec.drive] ?? 'Antriebsart offen'}), Schwerpunkt: ${TYPE_LABEL[focusUse] ?? focusUse}.`,
    `Budget: ${b.min ?? 0}–${b.max ?? 'offen'} € (zusätzlich 1–2 deutlich bessere Premium-Modelle bis ca. +40 % nennen). Zustand: ${spec.condition}.`,
    `Gewünschte Einsatzzwecke (Gewicht 1–5): ${spec.uses.map((u) => `${TYPE_LABEL[u.type]} ${u.weight}`).join(', ')}.`,
    spec.brandsPreferred.length ? `Bevorzugte Hersteller: ${spec.brandsPreferred.join(', ')}.` : `Hersteller, die du berücksichtigen kannst: ${brandsPool.join(', ')}.`,
    spec.brandsExcluded.length ? `Ausgeschlossene Hersteller: ${spec.brandsExcluded.join(', ')}.` : '',
    spec.electric ? `Motor/Akku: bevorzugt ${spec.motor.brands.join(', ') || 'egal'}; Konzept ${spec.motor.concept}; Akku mindestens ≈ ${spec.battery.whMin ?? '?'} Wh; Reichweite ${spec.battery.rangeKm ?? '?'} km.` : '',
    `Ausstattung: Schaltung ${spec.equipment.drivetrain}, Bremsen ${spec.equipment.brakes}, Federung ${spec.equipment.suspension}.`,
    Object.keys(spec.features).length ? `Wichtige Merkmale: ${Object.entries(spec.features).map(([k, v]) => `${k} (${v === 'must' ? 'Muss' : 'Wunsch'})`).join(', ')}.` : '',
    `Körpergröße ${spec.ergo.heightCm ?? '?'} cm (empfohlene Rahmengröße ${spec.ergo.frame?.letter ?? '?'}) – gib die verfügbaren Rahmengrößen an.`,
    'Liefere 4–6 passende Modelle als JSON.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try { return JSON.parse(candidate); } catch { return null; }
}

export class ClaudeWebProvider {
  id = 'claude-web';
  label = 'Live-Websuche (Claude + Websuche)';
  constructor(config, brandsPool = [], fetchImpl = globalThis.fetch) {
    this.cfg = config; this.brandsPool = brandsPool; this.fetch = fetchImpl;
  }

  async isAvailable() {
    return this.cfg.anthropicKey ? { ok: true } : { ok: false, reason: 'ANTHROPIC_API_KEY nicht gesetzt' };
  }

  async call(messages, signal) {
    const res = await this.fetch(API, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': this.cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: this.cfg.model, max_tokens: 8000, system: SYSTEM, messages,
        tools: [{ type: this.cfg.webSearchTool, name: 'web_search', max_uses: 8, user_location: { type: 'approximate', country: 'DE' } }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  }

  /** Eine Recherche-Runde (inkl. pause_turn-Fortsetzung). */
  async research(prompt, signal) {
    const messages = [{ role: 'user', content: prompt }];
    const seen = new Set(); const seenHosts = new Set(); let text = '';
    for (let i = 0; i < 5; i++) {
      const data = await this.call(messages, signal);
      for (const block of data.content ?? []) {
        if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
          for (const r of block.content) if (r.url) { seen.add(normUrl(r.url)); seenHosts.add(host(r.url)); }
        }
        if (block.type === 'text') {
          text += block.text;
          for (const c of block.citations ?? []) if (c.url) { seen.add(normUrl(c.url)); seenHosts.add(host(c.url)); }
        }
      }
      if (data.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: data.content });
    }
    return { text, seen, seenHosts };
  }

  async search(spec, { signal, onProgress = () => {} } = {}) {
    const uses = [...spec.uses].sort((a, b) => b.weight - a.weight).slice(0, this.cfg.maxSearchRequests).map((u) => u.type);
    const notes = []; const bikes = new Map();
    const retrievedAt = new Date().toISOString();
    let done = 0;
    await Promise.all(uses.map(async (use) => {
      try {
        const { text, seen, seenHosts } = await this.research(buildPrompt(spec, use, this.brandsPool), signal);
        const parsed = extractJson(text);
        if (!parsed?.bikes) { notes.push(`Keine auswertbare Antwort für „${TYPE_LABEL[use]}“.`); return; }
        for (const raw of parsed.bikes) {
          const { ok, bike } = normalizeBike(raw, { provider: this.id, retrievedAt });
          if (!ok) continue;
          const exact = seen.has(normUrl(bike.url));
          const sameHost = seenHosts.has(host(bike.url));
          // „verified“ nur, wenn die Produkt-URL tatsächlich unter den Suchtreffern war UND Preis vorhanden ist
          bike.verification.status = exact && bike.price.amount != null ? 'verified' : sameHost ? 'partial' : 'unverified';
          bike.verification.note = exact ? 'Produktseite in der Websuche gefunden' : sameHost ? 'Händler/Hersteller gefunden, genaue Produktseite nicht bestätigt' : 'Produktseite nicht in den Suchtreffern – bitte selbst prüfen';
          const prev = bikes.get(bike.id);
          if (!prev || rank(bike) > rank(prev)) bikes.set(bike.id, bike);
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        notes.push(`Suche „${TYPE_LABEL[use]}“ fehlgeschlagen: ${e.message}`);
      } finally { onProgress(`${++done}/${uses.length} Suchläufe abgeschlossen`); }
    }));
    return { bikes: [...bikes.values()], notes };
  }
}

const rank = (b) => ({ verified: 3, partial: 2, unverified: 1 }[b.verification.status] ?? 0);
