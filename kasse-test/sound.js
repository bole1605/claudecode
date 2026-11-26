'use strict';
// Töne der Kasse: kurze, weiche Signale, direkt im Browser erzeugt (Web Audio, keine Dateien).
// Einstellungen kommen von außen: Sound.setup({ on: true, vol: 'low' | 'mid' | 'high', tap: true })
//
// Klang: nur Sinus-Töne mit weichem Einsatz und ausklingender Hüllkurve (kein Knacken), ein Tiefpass nimmt harte Obertöne weg,
// ein Kompressor verhindert Übersteuern. Beim schnellen Tippen werden überlappende Töne begrenzt.
(function (root) {
  let ctx = null, cfg = { on: true, vol: 'mid', tap: true, style: 'soft' }, silent = null, active = 0;
  const lastAt = {}, VOL = { low: 0.2, mid: 0.42, high: 0.8 };
  const SHORT = { tick: 1, key: 1, minus: 1 };   // Antipp-Töne: werden gedrosselt
  // Klangart der Antipp-Töne: weich (Standard) oder tief (dumpfer, für kleine Lautsprecher mit schepperndem Klang)
  const STYLES = { soft: {}, low: { tick: { f: 360, to: 250, d: 0.09 }, key: { f: 300, to: 220, d: 0.08 }, minus: { f: 230, to: 170, d: 0.11 } } };

  // Töne: Liste aus { f: Frequenz Hz, to: Zielfrequenz (Tonhöhe gleitet), d: Dauer s, at: Start s, a: Einsatz s, v: relative Lautstärke }
  const TONES = {
    tick:     [{ f: 760, to: 560, d: 0.07, at: 0, a: 0.004, v: 1.15 }],                                                                    // Kachel antippen: weiches „Plopp“
    key:      [{ f: 620, to: 480, d: 0.06, at: 0, a: 0.004, v: 0.9 }],                                                                    // Ziffernblock
    minus:    [{ f: 420, to: 300, d: 0.09, at: 0, a: 0.005, v: 1.1 }],                                                                   // Artikel entfernen
    booked:   [{ f: 523, d: 0.14, at: 0, v: 0.8 }, { f: 659, d: 0.14, at: 0.09, v: 0.8 }, { f: 784, d: 0.3, at: 0.18, v: 0.9 }],            // Bon verbucht
    donation: [{ f: 392, d: 0.18, at: 0, v: 0.7 }, { f: 523, d: 0.18, at: 0.13, v: 0.8 }, { f: 659, d: 0.18, at: 0.26, v: 0.8 }, { f: 784, d: 0.4, at: 0.39, v: 0.9 }],   // Spende
    error:    [{ f: 247, d: 0.16, at: 0, a: 0.01, v: 0.8 }, { f: 196, d: 0.24, at: 0.17, a: 0.01, v: 0.8 }],                              // Fehler / falsches Passwort
    storno:   [{ f: 440, to: 330, d: 0.14, at: 0, v: 0.7 }, { f: 330, to: 247, d: 0.24, at: 0.12, v: 0.7 }],                              // Storno
    newOrder: [{ f: 880, d: 0.22, at: 0, v: 0.9 }, { f: 1320, d: 0.16, at: 0, v: 0.25 }, { f: 660, d: 0.38, at: 0.2, v: 0.9 }, { f: 990, d: 0.24, at: 0.2, v: 0.25 }],   // neue Bestellung (Ding-Dong)
    ready:    [{ f: 1047, d: 0.16, at: 0, v: 0.8 }, { f: 1319, d: 0.16, at: 0.11, v: 0.8 }, { f: 1568, d: 0.34, at: 0.22, v: 0.9 }]         // Bestellung fertig
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
    return ctx;
  }

  // Ausgangskette je Audio-Kontext: Tiefpass (nimmt harte Obertöne weg) -> Kompressor (verhindert Übersteuern) -> Lautsprecher
  function chain(c) {
    if (c.__kasse) return c.__kasse;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.5;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -4; comp.knee.value = 6; comp.ratio.value = 12; comp.attack.value = 0.002; comp.release.value = 0.12;   // nur als Sicherung gegen Übersteuern
    lp.connect(comp); comp.connect(c.destination);
    return (c.__kasse = lp);
  }

  // Stellt die Töne eines Signals auf dem Kontext c ein (live und für die Messung im Test)
  function schedule(c, name, master, t0, onEnd) {
    const dest = chain(c), st = (STYLES[cfg.style] || {})[name], seq = TONES[name].map(t => Object.assign({}, t, st || {})); let n = 0;
    for (const t of seq) {
      const o = c.createOscillator(), g = c.createGain(), s = t0 + t.at, a = t.a || 0.008, tau = Math.max(0.004, (t.d - a) / 4);
      o.type = 'sine'; o.frequency.setValueAtTime(t.f, s); if (t.to) o.frequency.exponentialRampToValueAtTime(t.to, s + t.d * 0.8);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(master * t.v * 0.35, s + a); g.gain.setTargetAtTime(0, s + a, tau);   // weicher Einsatz, ausklingend
      o.connect(g); g.connect(dest); o.start(s); o.stop(s + t.d + 0.08);
      if (onEnd) { n++; o.onended = () => { if (--n === 0) onEnd(); }; }
    }
  }

  // Muss nach einer Berührung aufgerufen werden (Browser-Vorgabe). Auf dem iPad bleiben Töne mit dem Seitenschalter „stumm“ sonst aus:
  // ein stilles <audio> schaltet die Tonausgabe auf „Wiedergabe“.
  function unlock() {
    const c = ensure(); if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (!silent && root.document) {
      try {
        const a = root.document.createElement('audio'); a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', '');
        a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
        a.volume = 0.01; silent = a; a.play().catch(() => {});
      } catch (e) {}
    }
  }

  function play(name) {
    if (!cfg.on) return;
    if ((name === 'tick' || name === 'key') && !cfg.tap) return;
    const seq = TONES[name]; if (!seq) return;
    const now = Date.now();
    if (SHORT[name]) {   // schnelles Tippen: zu dichte oder zu viele Töne würden sich überlagern und scheppern
      if (now - (lastAt.short || 0) < 45 || active > 6) return;
      lastAt.short = now;
    }
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    active++;
    schedule(c, name, VOL[cfg.vol] != null ? VOL[cfg.vol] : VOL.mid, c.currentTime + 0.01, () => { active = Math.max(0, active - 1); });
  }

  // Für Tests: Signal ohne Lautsprecher berechnen (Float32Array, 44,1 kHz)
  async function render(name, vol) {
    const OC = root.OfflineAudioContext; if (!OC) return null;
    const c = new OC(1, 44100, 44100); schedule(c, name, VOL[vol || 'mid'], 0.01);
    return (await c.startRendering()).getChannelData(0);
  }

  root.Sound = { play, unlock, render, names: Object.keys(TONES), setup: o => { cfg = Object.assign({}, cfg, o || {}); }, get config() { return cfg; } };
})(typeof self !== 'undefined' ? self : this);
