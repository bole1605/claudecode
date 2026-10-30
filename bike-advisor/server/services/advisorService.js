import { buildSpec } from '../../shared/spec.js';
import { frameAdvice, batteryAdvice } from '../../shared/derive.js';

const SYSTEM = `Du bist ein unabhängiger, ehrlicher Fahrrad-Experte (E-Bikes, MTB, Gravel, Trekking, City, Cargo).
Antworte auf Deutsch, präzise und verständlich, in höchstens ~200 Wörtern. Beziehe dich auf die Nutzerdaten (JSON), wenn sie relevant sind.
Erfinde keine konkreten Modelle, Preise oder Datenblätter; sage ehrlich, wenn etwas vom Einzelfall abhängt oder du unsicher bist.`;

export class AdvisorService {
  constructor(config, fetchImpl = globalThis.fetch) { this.cfg = config; this.fetch = fetchImpl; }
  get available() { return !!this.cfg.anthropicKey; }

  async ask(question, answers, history = []) {
    if (!this.available) { const e = new Error('KI-Berater nicht verfügbar: ANTHROPIC_API_KEY ist nicht konfiguriert.'); e.status = 503; throw e; }
    const spec = buildSpec(answers);
    const context = {
      antriebsart: spec.drive, einsatz: spec.uses, budget: spec.budget, gelaende: spec.terrain, hoehenmeterPro100km: spec.climbM100,
      koerpergroesse: spec.ergo.heightCm, fahrergewicht: spec.ergo.weightKg, gewuenschteReichweite: spec.battery?.rangeKm ?? null,
      akkuEmpfehlung: batteryAdvice(answers)?.title ?? null, rahmengroesse: frameAdvice(answers)?.title ?? null,
    };
    const messages = [
      ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: `Nutzerdaten: ${JSON.stringify(context)}\n\nFrage: ${question}` },
    ];
    const res = await this.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': this.cfg.anthropicKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: this.cfg.model, max_tokens: 1000, system: SYSTEM, messages }),
    });
    if (!res.ok) { const e = new Error(`KI-Anfrage fehlgeschlagen (${res.status})`); e.status = 502; throw e; }
    const data = await res.json();
    return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  }
}
