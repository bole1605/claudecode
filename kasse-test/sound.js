'use strict';
// Töne der Kasse: nur zwei Signale, direkt im Browser erzeugt (Web Audio, keine Dateien):
//   booked = Einkauf (oder Spende) fertig verbucht, ready = Bestellung fertig zubereitet.
// Einstellungen kommen von außen: Sound.setup({ on: true, vol: 'low' | 'mid' | 'high' })
(function (root) {
  let ctx = null, cfg = { on: true, vol: 'mid' }, silent = null;
  const VOL = { low: 0.18, mid: 0.4, high: 0.85 };

  // Töne: Liste aus { f: Frequenz Hz, d: Dauer s, at: Startzeit s, w: Wellenform, v: relative Lautstärke }
  const TONES = {
    booked: [{ f: 523, d: 0.1, at: 0, w: 'sine', v: 0.8 }, { f: 659, d: 0.1, at: 0.09, w: 'sine', v: 0.8 }, { f: 784, d: 0.22, at: 0.18, w: 'sine', v: 0.9 }],      // verbucht
    ready:  [{ f: 1047, d: 0.12, at: 0, w: 'sine', v: 0.8 }, { f: 1319, d: 0.12, at: 0.11, w: 'sine', v: 0.8 }, { f: 1568, d: 0.3, at: 0.22, w: 'sine', v: 0.9 }]     // fertig zubereitet
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  // Ein echtes, sehr leises WAV (1 s, 8 Bit) – ein leeres WAV schaltet nichts um
  function silentUrl() {
    const n = 8000, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b[44 + i] = 128 + (i % 2);   // fast Stille (Mitte ±1)
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }

  // Muss nach einer Berührung aufgerufen werden. Auf dem iPad schaltet der Seitenschalter „stumm“ sonst Web Audio ab:
  // Ton-Kategorie „Wiedergabe“ (iOS 17+) und ein leise laufendes Audio-Element halten die Ausgabe offen.
  function unlock() {
    try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback'; } catch (e) {}
    const c = ensure(); if (c && c.state !== 'running') c.resume().catch(() => {});
    if (!silent && root.document) {
      try {
        const a = root.document.createElement('audio'); a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', ''); a.setAttribute('aria-hidden', 'true');
        a.src = silentUrl(); a.volume = 0.02; silent = a; a.play().catch(() => { silent = null; });
      } catch (e) { silent = null; }
    }
  }

  function play(name) {
    if (!cfg.on) return;
    const c = ensure(), seq = TONES[name]; if (!c || !seq) return;
    try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = 'playback'; } catch (e) {}
    if (c.state !== 'running') c.resume().catch(() => {});
    const master = VOL[cfg.vol] != null ? VOL[cfg.vol] : VOL.mid, t0 = c.currentTime + 0.01;
    for (const n of seq) {
      const o = c.createOscillator(), g = c.createGain(), s = t0 + n.at, e = s + n.d;
      o.type = n.w; o.frequency.setValueAtTime(n.f, s);
      const peak = Math.max(0.0001, master * n.v * 0.35);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + Math.min(0.01, n.d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(g); g.connect(c.destination); o.start(s); o.stop(e + 0.02);
    }
  }

  root.Sound = { play, unlock, names: Object.keys(TONES), setup: o => { cfg = Object.assign({}, cfg, o || {}); }, get config() { return cfg; } };
})(typeof self !== 'undefined' ? self : this);
