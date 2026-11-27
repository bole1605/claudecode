'use strict';
// Töne der Kasse: direkt im Browser erzeugt (Web Audio, keine Dateien). Zwei Ereignisse, jedes mit einem Ton aus der Klangbibliothek:
//   booked = Einkauf (oder Spende) fertig verbucht, ready = Bestellung abholbereit. Jeder Ton ist einzeln schaltbar.
// Einstellungen kommen von außen: Sound.setup({ on, vol: 'low' | 'mid' | 'high', tones: { booked, ready }, pick: { booked: 'horn', ready: 'hell' }, mode })
// mode: 'short'  = Ton kurz als Medienwiedergabe (hörbar auch bei stummem iPad), danach gibt die Seite die Tonausgabe wieder frei (Standard)
//       'off'    = normaler Web-Audio-Ton, mischt sich mit anderer Musik (z. B. Spotify), bei stummem iPad aber still
//       'always' = dauerhaft bereit (ein stilles Audio läuft ständig): hörbar bei stumm, blockiert aber andere Musik
(function (root) {
  const DEFAULT_PICK = { booked: 'horn', ready: 'hell' };
  let ctx = null, cfg = { on: true, vol: 'mid', tones: { booked: true, ready: false }, pick: Object.assign({}, DEFAULT_PICK), mode: 'short' }, silent = null, player = null;
  const cache = {};
  const modeOf = () => cfg.mode === 'off' || cfg.mode === 'always' ? cfg.mode : 'short';
  const setType = t => { try { if (root.navigator && root.navigator.audioSession) root.navigator.audioSession.type = t; } catch (e) {} };
  const toneOn = n => { const t = cfg.tones || {}; return t[n] != null ? !!t[n] : n !== 'ready'; };   // Abholbereit ist ab Werk aus
  const VOL = { low: 0.18, mid: 0.4, high: 0.85 };

  // Ton = Liste aus { f: Frequenz Hz, d: Dauer s, at: Startzeit s, w: Wellenform, v: relative Lautstärke, a: Einschwingzeit, rel: Haltezeit-Ende, lp: Tiefpass Hz }
  const bell = (f, at, d, v) => [{ f, d, at, w: 'sine', v }, { f: f * 2.76, d: d * 0.55, at, w: 'sine', v: v * 0.35 }, { f: f * 5.4, d: d * 0.3, at, w: 'sine', v: v * 0.15 }];   // Glocke: Grundton + unharmonische Obertöne
  const horn = (low, d) => [{ f: low, d, at: 0, w: 'sawtooth', v: 0.9, a: 0.09, rel: 0.3, lp: 520 }, { f: low * 1.5, d, at: 0, w: 'sawtooth', v: 0.7, a: 0.09, rel: 0.3, lp: 520 }, { f: low * 2, d, at: 0, w: 'sawtooth', v: 0.45, a: 0.09, rel: 0.3, lp: 520 }];
  const LIBRARY = {
    horn:      { name: 'Schiffshorn', seq: horn(98, 1.0) },
    nebelhorn: { name: 'Nebelhorn (tief, lang)', seq: horn(73, 1.5) },
    kasse:     { name: 'Kassenklingel', seq: [].concat(bell(2093, 0, 0.5, 0.8), bell(2637, 0.11, 0.9, 0.8)) },
    glocke:    { name: 'Glocke', seq: bell(880, 0, 1.4, 0.9) },
    gong:      { name: 'Gong (tief)', seq: bell(196, 0, 2.0, 0.9) },
    tuer:      { name: 'Türgong (Ding-Dong)', seq: [].concat(bell(880, 0, 0.9, 0.8), bell(659, 0.38, 1.2, 0.8)) },
    dreiklang: { name: 'Dreiklang', seq: [{ f: 523, d: 0.1, at: 0, w: 'sine', v: 0.8 }, { f: 659, d: 0.1, at: 0.09, w: 'sine', v: 0.8 }, { f: 784, d: 0.22, at: 0.18, w: 'sine', v: 0.9 }] },
    hell:      { name: 'Heller Dreiklang', seq: [{ f: 1047, d: 0.12, at: 0, w: 'sine', v: 0.8 }, { f: 1319, d: 0.12, at: 0.11, w: 'sine', v: 0.8 }, { f: 1568, d: 0.3, at: 0.22, w: 'sine', v: 0.9 }] },
    xylophon:  { name: 'Xylophon', seq: [784, 988, 1175, 1568].map((f, i) => ({ f, d: 0.22, at: i * 0.09, w: 'triangle', v: 0.8 })) },
    fanfare:   { name: 'Fanfare', seq: [{ f: 392, d: 0.14, at: 0, w: 'triangle', v: 0.7 }, { f: 523, d: 0.14, at: 0.14, w: 'triangle', v: 0.7 }, { f: 659, d: 0.14, at: 0.28, w: 'triangle', v: 0.7 }, { f: 523, d: 0.7, at: 0.42, w: 'triangle', v: 0.6, a: 0.02, rel: 0.25 }, { f: 659, d: 0.7, at: 0.42, w: 'triangle', v: 0.6, a: 0.02, rel: 0.25 }, { f: 784, d: 0.7, at: 0.42, w: 'triangle', v: 0.6, a: 0.02, rel: 0.25 }] },
    glöckchen: { name: 'Schlittenglöckchen', seq: [0, 1, 2, 3, 4, 5].map(i => ({ f: i % 2 ? 3136 : 2637, d: 0.18, at: i * 0.07, w: 'sine', v: 0.55 })) },
    blip:      { name: 'Kurzer Doppelton', seq: [{ f: 880, d: 0.08, at: 0, w: 'sine', v: 0.8 }, { f: 1175, d: 0.14, at: 0.09, w: 'sine', v: 0.8 }] }
  };
  const idFor = n => { const p = (cfg.pick || {})[n]; return LIBRARY[p] ? p : DEFAULT_PICK[n]; };

  function ensure() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  // Ein echtes, ganz stilles WAV (1 s, 8 Bit, Mittellage) – ein leeres WAV schaltet nichts um
  function silentUrl() {
    const n = 8000, b = new Uint8Array(44 + n), dv = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) b[44 + i] = 128;   // echte Stille (Mittellage, kein Ton)
    return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
  }

  // Muss nach einer Berührung aufgerufen werden. Auf dem iPad schaltet der Seitenschalter „stumm“ sonst Web Audio ab:
  // Ton-Kategorie „Wiedergabe“ (iOS 17+) und ein leise laufendes Audio-Element halten die Ausgabe offen.
  function stopSilent() { if (silent) { try { silent.pause(); silent.removeAttribute('src'); silent.load(); } catch (e) {} silent = null; } }
  function unlock() {
    const m = modeOf();
    if (m !== 'always') { stopSilent(); return; }   // kein Dauerton: andere Musik bleibt ungestört
    setType('playback');
    const c = ensure(); if (c && c.state !== 'running') c.resume().catch(() => {});
    if (!silent && root.document) {
      try {
        const a = root.document.createElement('audio'); a.loop = true; a.preload = 'auto'; a.setAttribute('playsinline', ''); a.setAttribute('aria-hidden', 'true');
        a.src = silentUrl(); a.volume = 0.02; silent = a; a.play().catch(() => { silent = null; });
      } catch (e) { silent = null; }
    }
  }

  function schedule(c, seq, master, t0) {
    for (const n of seq) {
      const o = c.createOscillator(), g = c.createGain(), s = t0 + n.at, e = s + n.d;
      o.type = n.w; o.frequency.setValueAtTime(n.f, s);
      const peak = Math.max(0.0001, master * n.v * 0.35);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(peak, s + (n.a || Math.min(0.01, n.d / 3)));
      if (n.rel) g.gain.setValueAtTime(peak, e - n.rel);   // Horn: Ton bleibt stehen, dann ausklingen
      g.gain.exponentialRampToValueAtTime(0.0001, e);
      if (n.lp) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = n.lp; o.connect(lp); lp.connect(g); } else o.connect(g);
      g.connect(c.destination); o.start(s); o.stop(e + 0.02);
    }
  }
  const masterVol = () => VOL[cfg.vol] != null ? VOL[cfg.vol] : VOL.mid;

  // Web Audio direkt (stumm = still, mischt sich mit anderer Musik)
  function playWeb(seq) {
    const c = ensure(); if (!c || !seq) return;
    setType(modeOf() === 'always' ? 'playback' : 'auto');
    if (c.state !== 'running') c.resume().catch(() => {});
    schedule(c, seq, masterVol(), c.currentTime + 0.01);
  }

  // Klang als WAV vorrechnen (Offline-Rendering), damit er wie ein kurzes Medium abgespielt werden kann
  function wavUrl(id, seq) {
    const key = id + '|' + (cfg.vol || 'mid'); if (cache[key]) return cache[key];
    const OAC = root.OfflineAudioContext || root.webkitOfflineAudioContext; if (!OAC) return Promise.reject(new Error('no offline audio'));
    const rate = 44100, dur = seq.reduce((m, n) => Math.max(m, n.at + n.d), 0) + 0.15, oc = new OAC(1, Math.ceil(rate * dur), rate);
    schedule(oc, seq, masterVol(), 0.01);
    return cache[key] = Promise.resolve(oc.startRendering()).then(buf => {
      const d = buf.getChannelData(0), n = d.length, b = new Uint8Array(44 + n * 2), dv = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
      w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
    });
  }

  // Kurzmodus: Klang als Medienwiedergabe (läuft auch bei stummem iPad), danach Tonausgabe wieder freigeben
  function playShort(id, seq) {
    if (!root.document || !root.Audio) return playWeb(seq);
    wavUrl(id, seq).then(url => {
      if (!player) { player = new root.Audio(); player.setAttribute('playsinline', ''); player.addEventListener('ended', () => setType('auto')); }
      player.src = url; setType('transient'); if (root.navigator && root.navigator.audioSession && root.navigator.audioSession.type !== 'transient') setType('playback');
      const p = player.play(); if (p && p.catch) p.catch(() => { setType('auto'); playWeb(seq); });
    }).catch(() => playWeb(seq));
  }
  function playSeq(seq, id) {
    if (!seq) return;
    if (modeOf() === 'short') playShort(id, seq); else playWeb(seq);
  }

  // Ereignis abspielen ('booked' / 'ready'); force: auch wenn ausgeschaltet (Probehören)
  function play(name, force) {
    if (!DEFAULT_PICK[name]) return;
    if (!force && (!cfg.on || !toneOn(name))) return;
    const id = idFor(name); playSeq(LIBRARY[id].seq, id);
  }
  function preview(id) { if (LIBRARY[id]) playSeq(LIBRARY[id].seq, id); }

  root.Sound = { play, preview, unlock, names: Object.keys(DEFAULT_PICK), library: Object.keys(LIBRARY).map(id => ({ id, name: LIBRARY[id].name })), defaults: DEFAULT_PICK, pickOf: idFor, toneOn,
    setup: o => { cfg = Object.assign({}, cfg, o || {}); if (modeOf() !== 'always') stopSilent(); }, get config() { return cfg; } };
})(typeof self !== 'undefined' ? self : this);
