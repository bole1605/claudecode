'use strict';
// Töne der Kasse: kurze, leise Signale, direkt im Browser erzeugt (Web Audio, keine Dateien).
// Einstellungen kommen von außen: Sound.setup({ on: true, vol: 'low' | 'mid' | 'high', tap: true })
(function (root) {
  let ctx = null, cfg = { on: true, vol: 'mid', tap: true }, silent = null;
  const VOL = { low: 0.18, mid: 0.4, high: 0.85 };

  // Töne: Liste aus { f: Frequenz Hz, d: Dauer s, at: Startzeit s, w: Wellenform, v: relative Lautstärke, to: Zielfrequenz }
  const TONES = {
    tick:     [{ f: 1250, d: 0.03, at: 0, w: 'triangle', v: 0.5 }],                                 // Kachel antippen
    key:      [{ f: 900, d: 0.025, at: 0, w: 'triangle', v: 0.4 }],                                  // Ziffernblock
    minus:    [{ f: 520, d: 0.05, at: 0, w: 'triangle', v: 0.6 }],                                   // Artikel entfernen
    booked:   [{ f: 523, d: 0.1, at: 0, w: 'sine', v: 0.8 }, { f: 659, d: 0.1, at: 0.09, w: 'sine', v: 0.8 }, { f: 784, d: 0.22, at: 0.18, w: 'sine', v: 0.9 }],   // Bon verbucht
    donation: [{ f: 392, d: 0.14, at: 0, w: 'sine', v: 0.7 }, { f: 523, d: 0.14, at: 0.13, w: 'sine', v: 0.8 }, { f: 659, d: 0.14, at: 0.26, w: 'sine', v: 0.8 }, { f: 784, d: 0.35, at: 0.39, w: 'sine', v: 0.9 }],   // Spende
    error:    [{ f: 220, d: 0.12, at: 0, w: 'square', v: 0.35 }, { f: 196, d: 0.18, at: 0.15, w: 'square', v: 0.35 }],   // Fehler / falsches Passwort
    storno:   [{ f: 440, d: 0.12, at: 0, w: 'triangle', v: 0.7, to: 330 }, { f: 330, d: 0.2, at: 0.12, w: 'triangle', v: 0.7, to: 247 }],    // Storno
    newOrder: [{ f: 880, d: 0.18, at: 0, w: 'sine', v: 0.9 }, { f: 1320, d: 0.12, at: 0, w: 'sine', v: 0.3 }, { f: 660, d: 0.34, at: 0.2, w: 'sine', v: 0.9 }, { f: 990, d: 0.2, at: 0.2, w: 'sine', v: 0.3 }],   // neue Bestellung (Ding-Dong)
    ready:    [{ f: 1047, d: 0.12, at: 0, w: 'sine', v: 0.8 }, { f: 1319, d: 0.12, at: 0.11, w: 'sine', v: 0.8 }, { f: 1568, d: 0.3, at: 0.22, w: 'sine', v: 0.9 }]   // Bestellung fertig
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
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
    const c = ensure(), seq = TONES[name]; if (!c || !seq) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    const master = VOL[cfg.vol] != null ? VOL[cfg.vol] : VOL.mid, t0 = c.currentTime + 0.01;
    for (const n of seq) {
      const o = c.createOscillator(), g = c.createGain(), s = t0 + n.at, e = s + n.d;
      o.type = n.w; o.frequency.setValueAtTime(n.f, s); if (n.to) o.frequency.linearRampToValueAtTime(n.to, e);
      const peak = Math.max(0.0001, master * n.v * 0.35);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + Math.min(0.01, n.d / 3)); g.gain.exponentialRampToValueAtTime(0.0001, e);
      o.connect(g); g.connect(c.destination); o.start(s); o.stop(e + 0.02);
    }
  }

  root.Sound = { play, unlock, names: Object.keys(TONES), setup: o => { cfg = Object.assign({}, cfg, o || {}); }, get config() { return cfg; } };
})(typeof self !== 'undefined' ? self : this);
