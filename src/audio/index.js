// ---------- audio ----------
// ============================================================
// SFX — synthesized click/hit/win effects
// ============================================================
const AudioFX = {
  ctx: null, enabled: true,
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => { });
    try { musicEnsure(); } catch (e) { }
  },
  tone(freq, dur, type, gain, when) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    try {
      const t0 = this.ctx.currentTime + (when || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.06, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { }
  },
  click() { this.tone(660, 0.045, 'square', 0.025); },
  good() { this.tone(880, 0.07, 'sine', 0.06); this.tone(1318, 0.09, 'sine', 0.05, 0.07); },
  bad() { this.tone(150, 0.2, 'sawtooth', 0.05); },
  tick() { this.tone(1250, 0.03, 'square', 0.03); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.06, i * 0.09)); },
  rank() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.06, i * 0.08)); },
};

// ============================================================
// SOUNDTRACK — procedural music synthesis (Web Audio, original)
// 10 tracks, all synthesized live (can't load audio / reproduce copyrighted music):
//   * 5 HOUSE tracks — dark / industrial house grammar (4-on-floor kick, clap on 2&4,
//     open hi-hat off-beats, 16th shuffle, sidechained rumble, gritty stab, metal-pipe lead),
//     in the Buckshot-Roulette ("General Release") lineage. Each in its own key / bpm / patterns.
//   * 5 DRONE tracks — Aphex-Twin "Selected Ambient Works Vol II"-style creepy industrial ambient:
//     no beat, continuous detuned drone stacks under a slow LFO filter, deep sub, tape hiss,
//     and sparse drenched events (distant metal clangs, eerie high pings, slow dissonant swells).
// buildMusic(cfg) builds a graph tailored to the track. musicSetTrack(id) crossfades.
// A state machine (silent/menu/explore/combat/boss) crossfades layer gains within a track.
// Respects the AudioFX.enabled mute. Audio path is browser-only. API = hoisted fns.
// ============================================================

let __music = null;
let __trackId = null;
let __pendingState = 'silent';
let __pendingTrack = 'cold_cathode';
let __musicVol = 0.6;

function __mkDistCurve(amount) {
  const n = 1024, c = new Float32Array(n), k = amount || 24;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  return c;
}

// ---- shared pattern templates (over 16 sixteenths). 1 = "ba" (tension), 2 = "boo" (resolve) ----
const PB_ROLL = [0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0]; // rolling off-beat bounce
const PB_PUMP = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0]; // on-beat pump
const PB_DRIVE = [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1]; // busy drive
const PS_HOOK = [1, 0, 1, 0, 2, 0, 0, 0, 1, 1, 0, 2, 0, 0, 0, 0]; // "ba ba boo, baba boo"
const PS_SYNC = [0, 0, 1, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 0, 0, 0]; // syncopated
const PL_HOOK = [1, 0, 1, 0, 2, 0, 0, 0, 1, 1, 0, 2, 0, 0, 0, 0]; // lead hook
const PL_CALL = [1, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 0, 1, 0, 0, 0]; // call-and-answer

// ============================================================
// TRACK LIBRARY
// ============================================================
const TRACKS = [
  // ---------- 5 HOUSE ----------
  {
    id: 'heavy_press', name: 'Heavy Press', kind: 'house', bpm: 145, rumbleHz: 36.71, modRatio: 1.71, revLen: 3.4, revLP: 3000,
    chords: [[146.83, 174.61, 207.65], [146.83, 174.61, 207.65], [146.83, 155.56, 207.65], [146.83, 174.61, 220.00]],
    bassNote: 73.42, bassPat: PB_ROLL, stabBa: [146.83, 207.65], stabBoo: [146.83, 220.00], stabPat: PS_HOOK,
    pipeBa: 415.30, pipeBoo: 293.66, pipe2Ba: 622.25, pipe2Boo: 440.00, leadPat: PL_HOOK,
    drum: { kick: [0, 4, 8, 12], clap: [4, 12], ohat: [2, 6, 10, 14], chat: 'classic', hatVel: 0.5, kickDecay: 0.22 },
    states: {
      menu: { kick: 0.48, hat: 0.36, perc: 0.06, pad: 0.5, bass: 0.25, rumble: 0.5, stab: 0.1, pipe: 0.14, pipe2: 0.08 },
      explore: { kick: 0.82, clap: 0.5, hat: 0.54, perc: 0.26, pad: 0.42, bass: 0.5, rumble: 0.62, stab: 0.2, pipe: 0.4, pipe2: 0.22 },
      combat: { kick: 0.94, clap: 0.68, hat: 0.62, perc: 0.52, pad: 0.38, bass: 0.74, rumble: 0.72, stab: 0.34, pipe: 0.5, pipe2: 0.28 },
      boss: { kick: 1.0, clap: 0.8, hat: 0.68, perc: 0.66, pad: 0.42, bass: 0.86, rumble: 0.82, stab: 0.46, pipe: 0.6, pipe2: 0.34 },
    },
  },
  {
    id: 'gate_shuffle', name: 'Gate Shuffle', kind: 'house', bpm: 124, rumbleHz: 55.0, modRatio: 1.41, revLen: 2.6, revLP: 3400,
    chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392.00], [196, 246.94, 293.66]],
    bassNote: 110.0, bassPat: PB_PUMP, stabBa: [220, 329.63], stabBoo: [220, 261.63], stabPat: PS_SYNC,
    pipeBa: 440.00, pipeBoo: 329.63, pipe2Ba: 659.25, pipe2Boo: 493.88, leadPat: PL_CALL,
    drum: { kick: [0, 4, 7, 8, 12, 15], clap: [4, 12], ohat: [2, 6, 10, 14], chat: 'shuffle', hatVel: 0.46, kickDecay: 0.2 },
    states: {
      menu: { kick: 0.42, hat: 0.4, perc: 0.08, pad: 0.4, bass: 0.24, rumble: 0.3, stab: 0.12, pipe: 0.16, pipe2: 0.1 },
      explore: { kick: 0.76, clap: 0.5, hat: 0.6, perc: 0.24, pad: 0.36, bass: 0.5, rumble: 0.4, stab: 0.22, pipe: 0.42, pipe2: 0.24 },
      combat: { kick: 0.9, clap: 0.66, hat: 0.66, perc: 0.46, pad: 0.32, bass: 0.7, rumble: 0.5, stab: 0.34, pipe: 0.5, pipe2: 0.3 },
      boss: { kick: 0.98, clap: 0.78, hat: 0.72, perc: 0.6, pad: 0.34, bass: 0.82, rumble: 0.58, stab: 0.44, pipe: 0.58, pipe2: 0.34 },
    },
  },
  {
    id: 'foundry_floor', name: 'Foundry Floor', kind: 'house', bpm: 130, rumbleHz: 46.25, modRatio: 1.71, revLen: 3.0, revLP: 2800,
    chords: [[185, 220, 277.18], [164.81, 196, 246.94], [146.83, 185, 220], [185, 233.08, 277.18]],
    bassNote: 92.50, bassPat: PB_DRIVE, stabBa: [185, 261.63], stabBoo: [185, 277.18], stabPat: PS_HOOK,
    pipeBa: 523.25, pipeBoo: 369.99, pipe2Ba: 739.99, pipe2Boo: 554.37, leadPat: PL_HOOK,
    drum: { kick: [0, 2, 4, 8, 10, 12], clap: [4, 12], ohat: [6, 14], chat: 'drive', hatVel: 0.4, kickDecay: 0.26 },
    states: {
      menu: { kick: 0.5, hat: 0.34, perc: 0.1, pad: 0.46, bass: 0.3, rumble: 0.56, stab: 0.12, pipe: 0.14, pipe2: 0.08 },
      explore: { kick: 0.86, clap: 0.52, hat: 0.52, perc: 0.3, pad: 0.4, bass: 0.56, rumble: 0.7, stab: 0.24, pipe: 0.4, pipe2: 0.22 },
      combat: { kick: 0.98, clap: 0.7, hat: 0.6, perc: 0.56, pad: 0.36, bass: 0.8, rumble: 0.8, stab: 0.38, pipe: 0.52, pipe2: 0.3 },
      boss: { kick: 1.0, clap: 0.82, hat: 0.66, perc: 0.7, pad: 0.4, bass: 0.9, rumble: 0.9, stab: 0.5, pipe: 0.62, pipe2: 0.36 },
    },
  },
  {
    id: 'clockwork', name: 'Clockwork', kind: 'house', bpm: 128, rumbleHz: 32.70, modRatio: 1.5, revLen: 2.4, revLP: 3200,
    chords: [[130.81, 155.56, 196], [174.61, 207.65, 261.63], [196, 233.08, 293.66], [130.81, 155.56, 207.65]],
    bassNote: 65.41, bassPat: PB_ROLL, stabBa: [130.81, 185], stabBoo: [130.81, 196], stabPat: PS_SYNC,
    pipeBa: 369.99, pipeBoo: 261.63, pipe2Ba: 554.37, pipe2Boo: 392.00, leadPat: PL_CALL,
    drum: { kick: [0, 4, 8, 11, 12], clap: [4, 12], ohat: [14], chat: 'tick', hatVel: 0.42, kickDecay: 0.18 },
    states: {
      menu: { kick: 0.46, hat: 0.42, perc: 0.12, pad: 0.42, bass: 0.26, rumble: 0.34, stab: 0.14, pipe: 0.16, pipe2: 0.1 },
      explore: { kick: 0.8, clap: 0.54, hat: 0.62, perc: 0.34, pad: 0.36, bass: 0.52, rumble: 0.44, stab: 0.26, pipe: 0.42, pipe2: 0.24 },
      combat: { kick: 0.92, clap: 0.7, hat: 0.7, perc: 0.54, pad: 0.32, bass: 0.72, rumble: 0.52, stab: 0.38, pipe: 0.5, pipe2: 0.3 },
      boss: { kick: 1.0, clap: 0.8, hat: 0.74, perc: 0.66, pad: 0.34, bass: 0.84, rumble: 0.6, stab: 0.48, pipe: 0.6, pipe2: 0.34 },
    },
  },
  {
    id: 'tapeline', name: 'Tapeline', kind: 'house', bpm: 138, rumbleHz: 41.20, modRatio: 1.71, revLen: 3.6, revLP: 3000,
    chords: [[164.81, 196, 246.94], [164.81, 185, 246.94], [146.83, 174.61, 220], [164.81, 196, 233.08]],
    bassNote: 82.41, bassPat: PB_DRIVE, stabBa: [164.81, 233.08], stabBoo: [164.81, 246.94], stabPat: PS_HOOK,
    pipeBa: 466.16, pipeBoo: 329.63, pipe2Ba: 698.46, pipe2Boo: 493.88, leadPat: PL_HOOK,
    drum: { kick: [0, 4, 8, 12, 14, 15], clap: [2, 4, 10, 12], ohat: [2, 6, 10, 14], chat: 'big', hatVel: 0.54, kickDecay: 0.24 },
    states: {
      menu: { kick: 0.5, hat: 0.38, perc: 0.1, pad: 0.5, bass: 0.3, rumble: 0.5, stab: 0.14, pipe: 0.18, pipe2: 0.12 },
      explore: { kick: 0.86, clap: 0.54, hat: 0.56, perc: 0.3, pad: 0.44, bass: 0.56, rumble: 0.64, stab: 0.26, pipe: 0.46, pipe2: 0.26 },
      combat: { kick: 0.96, clap: 0.72, hat: 0.64, perc: 0.56, pad: 0.4, bass: 0.78, rumble: 0.74, stab: 0.4, pipe: 0.56, pipe2: 0.32 },
      boss: { kick: 1.0, clap: 0.84, hat: 0.7, perc: 0.72, pad: 0.44, bass: 0.9, rumble: 0.84, stab: 0.52, pipe: 0.68, pipe2: 0.4 },
    },
  },

  // ---------- 5 DRONE (Aphex SAW-II creepy industrial ambient) ----------
  {
    id: 'cold_cathode', name: 'Cold Cathode', kind: 'drone', bpm: 64, revLen: 4.2, revLP: 3200,
    droneChord: [98, 146.83, 196, 293.66], detune: 6, subHz: 49.0, hissLevel: 0.012,
    filtLo: 300, filtHi: 1400, lfoRate: 0.05, hissHz: 2400, clangHz: 196, pingHz: 1567.98, swellChord: [196, 293.66, 392],
    states: {
      menu: { pad: 0.5, rumble: 0.4, perc: 0.3, stab: 0.18, pipe: 0.3 },
      explore: { pad: 0.62, rumble: 0.5, perc: 0.34, stab: 0.24, pipe: 0.4 },
      combat: { pad: 0.7, rumble: 0.62, perc: 0.42, stab: 0.4, pipe: 0.55 },
      boss: { pad: 0.78, rumble: 0.72, perc: 0.5, stab: 0.5, pipe: 0.66 },
    },
  },
  {
    id: 'rust_bloom', name: 'Rust Bloom', kind: 'drone', bpm: 60, revLen: 4.8, revLP: 2400,
    droneChord: [73.42, 77.78, 110, 116.54], detune: 9, subHz: 36.71, hissLevel: 0.02,
    filtLo: 200, filtHi: 900, lfoRate: 0.03, hissHz: 1500, clangHz: 146.83, pingHz: 932.33, swellChord: [146.83, 155.56, 233.08],
    states: {
      menu: { pad: 0.5, rumble: 0.46, perc: 0.34, stab: 0.2, pipe: 0.36 },
      explore: { pad: 0.6, rumble: 0.56, perc: 0.4, stab: 0.28, pipe: 0.48 },
      combat: { pad: 0.68, rumble: 0.66, perc: 0.5, stab: 0.44, pipe: 0.62 },
      boss: { pad: 0.76, rumble: 0.76, perc: 0.58, stab: 0.54, pipe: 0.72 },
    },
  },
  {
    id: 'halogen', name: 'Halogen', kind: 'drone', bpm: 68, revLen: 3.8, revLP: 3000,
    droneChord: [123.47, 130.81, 185, 246.94], detune: 11, subHz: 61.74, hissLevel: 0.015,
    filtLo: 350, filtHi: 1600, lfoRate: 0.07, hissHz: 2800, clangHz: 246.94, pingHz: 1318.51, swellChord: [185, 246.94, 369.99],
    states: {
      menu: { pad: 0.48, rumble: 0.38, perc: 0.32, stab: 0.16, pipe: 0.34 },
      explore: { pad: 0.6, rumble: 0.48, perc: 0.38, stab: 0.24, pipe: 0.46 },
      combat: { pad: 0.68, rumble: 0.58, perc: 0.46, stab: 0.4, pipe: 0.6 },
      boss: { pad: 0.76, rumble: 0.68, perc: 0.54, stab: 0.5, pipe: 0.7 },
    },
  },
  {
    id: 'substation_hum', name: 'Substation Hum', kind: 'drone', bpm: 56, revLen: 3.4, revLP: 2600,
    droneChord: [60, 120, 180, 240], detune: 3, subHz: 60.0, hissLevel: 0.025,
    filtLo: 250, filtHi: 1200, lfoRate: 0.02, hissHz: 1800, clangHz: 240, pingHz: 1200, swellChord: [120, 180, 300],
    states: {
      menu: { pad: 0.5, rumble: 0.44, perc: 0.38, stab: 0.18, pipe: 0.34 },
      explore: { pad: 0.6, rumble: 0.54, perc: 0.44, stab: 0.26, pipe: 0.46 },
      combat: { pad: 0.68, rumble: 0.64, perc: 0.52, stab: 0.42, pipe: 0.6 },
      boss: { pad: 0.76, rumble: 0.74, perc: 0.6, stab: 0.52, pipe: 0.7 },
    },
  },
  {
    id: 'black_ice', name: 'Black Ice', kind: 'drone', bpm: 52, revLen: 5.2, revLP: 2200,
    droneChord: [55, 77.78, 110, 155.56], detune: 8, subHz: 27.50, hissLevel: 0.018,
    filtLo: 180, filtHi: 800, lfoRate: 0.025, hissHz: 1400, clangHz: 110, pingHz: 830.61, swellChord: [110, 155.56, 220],
    states: {
      menu: { pad: 0.52, rumble: 0.46, perc: 0.3, stab: 0.22, pipe: 0.32 },
      explore: { pad: 0.62, rumble: 0.56, perc: 0.36, stab: 0.3, pipe: 0.44 },
      combat: { pad: 0.72, rumble: 0.68, perc: 0.46, stab: 0.46, pipe: 0.58 },
      boss: { pad: 0.8, rumble: 0.8, perc: 0.54, stab: 0.56, pipe: 0.7 },
    },
  },
];

// world (1-7) + context -> track id
const TRACK_FOR_WORLD = { 1: 'heavy_press', 2: 'gate_shuffle', 3: 'rust_bloom', 4: 'foundry_floor', 5: 'halogen', 6: 'clockwork', 7: 'black_ice' };
function trackForWorld(w) { return TRACK_FOR_WORLD[w] || 'heavy_press'; }

function buildMusic(cfg) {
  const ctx = AudioFX.ctx;
  if (!ctx) return null;
  const drone = cfg.kind === 'drone';
  const persistent = []; // continuous oscillators/sources to stop on teardown

  // ---- master chain ----
  const master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  try { comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.18; } catch (e) { }
  comp.connect(master);
  const duck = ctx.createGain(); duck.gain.value = 1; duck.connect(comp);          // sidechain target (house only)
  const lpMurk = ctx.createBiquadFilter(); lpMurk.type = 'lowpass'; lpMurk.frequency.value = drone ? 2200 : 2800; lpMurk.Q.value = 0.7;
  lpMurk.connect(duck);

  // layer gains
  const gKick = ctx.createGain(), gClap = ctx.createGain(), gHat = ctx.createGain(), gPerc = ctx.createGain(),
    gPad = ctx.createGain(), gBass = ctx.createGain(), gRumble = ctx.createGain(), gStab = ctx.createGain();
  [gKick, gClap, gHat, gPerc].forEach(g => { g.gain.value = 0.0001; g.connect(comp); });
  [gPad, gBass, gRumble].forEach(g => { g.gain.value = 0.0001; g.connect(lpMurk); });
  gStab.gain.value = 0.0001; gStab.connect(duck);
  const gPipe = ctx.createGain(); gPipe.gain.value = 0.0001; gPipe.connect(comp);
  const gPipe2 = ctx.createGain(); gPipe2.gain.value = 0.0001; gPipe2.connect(comp);

  // distortion buses
  const shKick = ctx.createWaveShaper(); shKick.curve = __mkDistCurve(20); shKick.oversample = '2x'; shKick.connect(gKick);
  const shBass = ctx.createWaveShaper(); shBass.curve = __mkDistCurve(40); shBass.oversample = '2x'; shBass.connect(gBass);
  const shRumble = ctx.createWaveShaper(); shRumble.curve = __mkDistCurve(34); shRumble.oversample = '2x'; shRumble.connect(gRumble);
  const shStab = ctx.createWaveShaper(); shStab.curve = __mkDistCurve(drone ? 12 : 30); shStab.oversample = '2x'; shStab.connect(gStab);
  const shPipe = ctx.createWaveShaper(); shPipe.curve = __mkDistCurve(14); shPipe.oversample = '2x'; shPipe.connect(gPipe);
  const shPipe2 = ctx.createWaveShaper(); shPipe2.curve = __mkDistCurve(14); shPipe2.oversample = '2x'; shPipe2.connect(gPipe2);

  // white-noise buffer + helpers
  const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate);
  const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; return s; };
  const noiseLoop = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; return s; };
  const og = (val) => { const g = ctx.createGain(); g.gain.value = val; return g; };

  // ---- reverb (size/darkness from cfg) + damped feedback echo ----
  const conv = ctx.createConvolver();
  { const len = Math.floor(ctx.sampleRate * (cfg.revLen || 3.4)), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, drone ? 2.0 : 2.6); }
    conv.buffer = ir; }
  const revLP = ctx.createBiquadFilter(); revLP.type = 'lowpass'; revLP.frequency.value = cfg.revLP || 3000;
  const gRev = ctx.createGain(); gRev.gain.value = drone ? 1.4 : 1.15; conv.connect(revLP); revLP.connect(gRev); gRev.connect(comp);
  const delay = ctx.createDelay(1.5); delay.delayTime.value = drone ? 0.62 : (60 / cfg.bpm) * 0.75;
  const dFb = ctx.createGain(); dFb.gain.value = drone ? 0.42 : 0.5; const dLP = ctx.createBiquadFilter(); dLP.type = 'lowpass'; dLP.frequency.value = 2300;
  delay.connect(dLP); dLP.connect(dFb); dFb.connect(delay);
  const gDelay = ctx.createGain(); gDelay.gain.value = drone ? 0.5 : 0.6; delay.connect(gDelay); gDelay.connect(comp);
  const revSend = ctx.createGain(); revSend.gain.value = drone ? 1.4 : 1.0; revSend.connect(conv);
  const delSend = ctx.createGain(); delSend.gain.value = drone ? 0.6 : 0.72; delSend.connect(delay);
  gPipe.connect(revSend); gPipe.connect(delSend); gPipe2.connect(revSend); gPipe2.connect(delSend);
  gStab.connect(revSend);  // swells (drone) ride the reverb too

  // ---- voices ----
  function kick(t, decay) {
    const dec = decay || 0.22;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(47, t + 0.09);
    g.gain.setValueAtTime(0.92, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(shKick); o.start(t); o.stop(t + dec + 0.04);
    const c = noise(), cg = ctx.createGain(), hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1800;
    cg.gain.setValueAtTime(0.4, t); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
    c.connect(hp); hp.connect(cg); cg.connect(gKick); c.start(t); c.stop(t + 0.04);
    try { duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.18, t + 0.001); duck.gain.linearRampToValueAtTime(1, t + 0.34); } catch (e) { }
  }
  function clap(t) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.2; bp.connect(gClap);
    [0, 0.008, 0.017].forEach((dt, i) => { const n = noise(), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + dt); g.gain.exponentialRampToValueAtTime(0.5 * (i === 2 ? 1 : 0.65), t + dt + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.03); n.connect(g); g.connect(bp); n.start(t + dt); n.stop(t + dt + 0.05); });
    const nt = noise(), gt = ctx.createGain(); gt.gain.setValueAtTime(0.0001, t + 0.018); gt.gain.exponentialRampToValueAtTime(0.28, t + 0.024); gt.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); nt.connect(gt); gt.connect(bp); nt.start(t + 0.018); nt.stop(t + 0.15);
  }
  function ohat(t, vel) {
    const n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 8000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    n.connect(hp); hp.connect(g); g.connect(gHat); n.start(t); n.stop(t + 0.16);
  }
  function chat(t, vel) {
    const n = noise(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 9000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.034);
    n.connect(hp); hp.connect(g); g.connect(gHat); n.start(t); n.stop(t + 0.05);
  }
  function bass(t, dur, freq) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(370, t); lp.frequency.exponentialRampToValueAtTime(150, t + dur); lp.Q.value = 7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [-7, 7].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d; o.connect(og(0.4)).connect(lp); o.start(t); o.stop(t + dur + 0.04); });
    lp.connect(g); g.connect(shBass);
  }
  function pad(t, dur, chord) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.3;
    lp.frequency.setValueAtTime(240, t); lp.frequency.linearRampToValueAtTime(500, t + dur * 0.5); lp.frequency.linearRampToValueAtTime(260, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + dur * 0.3); g.gain.setValueAtTime(1, t + dur * 0.66); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chord.forEach(f => { [-7, 8].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(og(0.08)).connect(lp); o.start(t); o.stop(t + dur + 0.1); });
      const os = ctx.createOscillator(); os.type = 'sawtooth'; os.frequency.value = f * 0.5; os.connect(og(0.07)).connect(lp); os.start(t); os.stop(t + dur + 0.1); });
    lp.connect(g); g.connect(gPad);
  }
  function stab(t, chord, vel) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(480, t + 0.16); bp.Q.value = 2.4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    chord.forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(og(0.3)).connect(bp); o.start(t); o.stop(t + 0.22);
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = f; o2.detune.value = 9; o2.connect(og(0.14)).connect(bp); o2.start(t); o2.stop(t + 0.22); });
    bp.connect(g); g.connect(shStab);
  }
  function clank(t, vel) {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    [1, 1.83, 2.71].forEach(r => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 440 * r; o.connect(og(0.18)).connect(bp); o.start(t); o.stop(t + 0.15); });
    bp.connect(g); g.connect(gPerc);
  }
  function pipe(t, freq, vel, dest) {
    const ratio = cfg.modRatio || 1.71;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(dest || shPipe);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(vel, t + 0.004); amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    amp.connect(out);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * ratio;
    const modG = ctx.createGain();
    modG.gain.setValueAtTime(freq * 7, t); modG.gain.exponentialRampToValueAtTime(freq * 0.5, t + 0.18);
    mod.connect(modG); modG.connect(car.frequency);
    car.connect(og(0.5)).connect(amp); car.start(t); car.stop(t + 0.55); mod.start(t); mod.stop(t + 0.55);
    [[2.76, 0.30, 0.32], [5.40, 0.18, 0.20], [8.93, 0.10, 0.12]].forEach(p => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * p[0];
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel * p[1], t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + p[2]);
      o.connect(g); g.connect(amp); o.start(t); o.stop(t + p[2] + 0.05);
    });
    const n = noise(), nbp = ctx.createBiquadFilter(), ng = ctx.createGain();
    nbp.type = 'bandpass'; nbp.frequency.value = 3200; nbp.Q.value = 1.5;
    ng.gain.setValueAtTime(vel * 0.4, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(nbp); nbp.connect(ng); ng.connect(amp); n.start(t); n.stop(t + 0.03);
  }
  // slow dissonant swell (drone) — through the stab bus -> reverb
  function swell(t, dur, chord) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(cfg.filtLo || 260, t); lp.frequency.linearRampToValueAtTime(cfg.filtHi || 1200, t + dur * 0.55); lp.frequency.linearRampToValueAtTime(cfg.filtLo || 260, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chord.forEach(f => { [-9, 9].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(og(0.08)).connect(lp); o.start(t); o.stop(t + dur + 0.1); }); });
    lp.connect(g); g.connect(shStab);
  }

  // ---- continuous bed ----
  if (drone) {
    // main detuned drone stack under a slow LFO lowpass
    const dLPf = ctx.createBiquadFilter(); dLPf.type = 'lowpass'; dLPf.Q.value = 1.4;
    dLPf.frequency.value = ((cfg.filtLo || 260) + (cfg.filtHi || 1200)) / 2; dLPf.connect(gPad);
    const lfo = ctx.createOscillator(); lfo.type = 'triangle'; lfo.frequency.value = cfg.lfoRate || 0.05;
    const lfoG = ctx.createGain(); lfoG.gain.value = Math.max(40, ((cfg.filtHi || 1200) - (cfg.filtLo || 260)) / 2);
    lfo.connect(lfoG); lfoG.connect(dLPf.frequency); lfo.start(); persistent.push(lfo);
    (cfg.droneChord || [110]).forEach(f => {
      [-(cfg.detune || 7), (cfg.detune || 7)].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(og(0.06)).connect(dLPf); o.start(); persistent.push(o); });
    });
    // deep sub (two slightly detuned sines)
    { const slp = ctx.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 120;
      const s1 = ctx.createOscillator(); s1.type = 'sine'; s1.frequency.value = cfg.subHz || 41; s1.connect(og(0.5)).connect(slp);
      const s2 = ctx.createOscillator(); s2.type = 'sine'; s2.frequency.value = cfg.subHz || 41; s2.detune.value = 5; s2.connect(og(0.3)).connect(slp);
      slp.connect(gRumble); s1.start(); s2.start(); persistent.push(s1, s2); }
    // tape hiss / noise floor
    { const h = noiseLoop(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = cfg.hissHz || 2000;
      const hg = og(cfg.hissLevel || 0.015); h.connect(hp); hp.connect(hg); hg.connect(gPerc); h.start(); persistent.push(h); }
  } else {
    // warehouse RUMBLE drone (saw + body) -> lowpass -> saturation -> ducked
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = cfg.rumbleHz || 36.71;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = (cfg.rumbleHz || 36.71) * 1.5; o2.detune.value = 5;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 155; rlp.Q.value = 1.0;
    o1.connect(og(0.5)).connect(rlp); o2.connect(og(0.22)).connect(rlp); rlp.connect(shRumble); o1.start(); o2.start(); persistent.push(o1, o2);
  }

  // ---- state machine ----
  const Z = { kick: 0, clap: 0, hat: 0, perc: 0, pad: 0, bass: 0, rumble: 0, stab: 0, pipe: 0, pipe2: 0 };
  function stateLayers(s) { return Object.assign({}, Z, (cfg.states && cfg.states[s]) || (s === 'silent' ? {} : {})); }
  const bpm = cfg.bpm || 120, sp16 = 60 / bpm / 4;
  let T = Z;
  let absStep = 0, nextTime = ctx.currentTime + 0.12, timer = null;

  function schedule(s, t) {
    const s16 = s % 16, s32 = s % 32;
    if (drone) {
      if (T.stab > 0.02 && s % 64 === 0) swell(t, sp16 * 48, cfg.swellChord || cfg.droneChord);
      if (T.pipe > 0.02 && s32 === 0 && Math.random() < 0.55) pipe(t, cfg.clangHz || 196, 0.4);          // distant metal clang
      if (T.pipe > 0.02 && s16 === 8 && Math.random() < (0.22 + 0.3 * T.pipe)) pipe(t, cfg.pingHz || 1318, 0.2); // eerie high ping
      if (T.perc > 0.45 && s % 48 === 24) clank(t, 0.26);                                                  // metallic tick
      return;
    }
    if (T.pad > 0.02 && s32 === 0) pad(t, sp16 * 32, cfg.chords[Math.floor(s / 32) % cfg.chords.length]);
    const D = cfg.drum;
    if (T.kick > 0.02 && D.kick.indexOf(s16) >= 0) kick(t, D.kickDecay);
    if (T.clap > 0.02 && D.clap.indexOf(s16) >= 0) clap(t);
    if (T.hat > 0.02) {
      if (D.ohat.indexOf(s16) >= 0) ohat(t, D.hatVel || 0.5);
      const m = D.chat;
      if (m === 'classic' || m === 'big') { if (s16 % 4 === 0) chat(t, 0.24); if (s16 % 2 === 1) chat(t + sp16 * 0.16, 0.12 + Math.random() * 0.05); }
      else if (m === 'shuffle') { if (s16 % 2 === 1) chat(t + sp16 * 0.2, 0.16 + Math.random() * 0.06); if (s16 % 4 === 0) chat(t, 0.18); }
      else if (m === 'drive') { if (s16 % 2 === 0) chat(t, 0.2); }
      else if (m === 'tick') { chat(t, s16 % 4 === 0 ? 0.22 : 0.13); }
    }
    if (T.bass > 0.02 && cfg.bassPat[s16]) bass(t, sp16 * (s16 % 2 === 0 ? 1.4 : 0.9), cfg.bassNote);
    if (T.stab > 0.02 && cfg.stabPat[s16]) stab(t, cfg.stabPat[s16] === 1 ? cfg.stabBa : cfg.stabBoo, 0.42);
    if (Math.floor(s / 64) % 2 === 0) {
      if (T.pipe > 0.02 && cfg.leadPat[s16]) pipe(t, cfg.leadPat[s16] === 1 ? cfg.pipeBa : cfg.pipeBoo, 0.5);
      if (T.pipe2 > 0.02 && cfg.leadPat[s16]) pipe(t, cfg.leadPat[s16] === 1 ? cfg.pipe2Ba : cfg.pipe2Boo, 0.45, shPipe2);
    }
    if (T.perc > 0.02 && (s16 === 7 || s16 === 15)) clank(t, 0.38);
    if (T.perc > 0.5 && s16 === 11) clank(t, 0.28);
  }

  function tick() {
    if (!ctx) return;
    const now = ctx.currentTime;
    try { master.gain.setTargetAtTime(AudioFX.enabled ? __musicVol : 0, now, 0.25); } catch (e) { }
    while (nextTime < now + 0.12) {
      if (AudioFX.enabled) { try { schedule(absStep, nextTime); } catch (e) { } }
      nextTime += sp16; absStep++;
    }
  }

  function rampLayer(node, v) {
    try {
      const now = ctx.currentTime;
      node.gain.cancelScheduledValues(now);
      node.gain.setValueAtTime(Math.max(0.0001, node.gain.value), now);
      node.gain.linearRampToValueAtTime(Math.max(0.0001, v), now + 1.6);
    } catch (e) { }
  }

  const api = {
    setState(s) {
      T = stateLayers(s);
      rampLayer(gKick, T.kick); rampLayer(gClap, T.clap); rampLayer(gHat, T.hat); rampLayer(gPerc, T.perc);
      rampLayer(gPad, T.pad); rampLayer(gBass, T.bass); rampLayer(gRumble, T.rumble); rampLayer(gStab, T.stab);
      rampLayer(gPipe, T.pipe || 0); rampLayer(gPipe2, T.pipe2 || 0);
    },
    ensure() { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); },
    setVolume(v) { __musicVol = Math.max(0, Math.min(1, v)); },
    stop() { if (timer) { clearInterval(timer); timer = null; } try { master.gain.setTargetAtTime(0, ctx.currentTime, 0.2); } catch (e) { } persistent.forEach(o => { try { o.stop(); } catch (e) { } }); },
    fadeOutStop(dur) {
      const d = dur || 0.7;
      try { const now = ctx.currentTime; master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now); master.gain.linearRampToValueAtTime(0.0001, now + d); } catch (e) { }
      if (timer) { clearInterval(timer); timer = null; }
      const stopAt = ctx.currentTime + d + 0.1;
      persistent.forEach(o => { try { o.stop(stopAt); } catch (e) { } });
      setTimeout(() => { try { master.disconnect(); } catch (e) { } }, (d + 0.25) * 1000);
    },
  };

  nextTime = ctx.currentTime + 0.12;
  timer = setInterval(tick, 25);
  return api;
}

// ---- hoisted public API (safe to call before init / before ctx exists) ----
// ============================================================
// MUSIC ENGINE — Web Audio synth tracks + state machine
// ============================================================
function musicEnsure() {
  if (!AudioFX.ctx) return;
  if (!__music) { musicSetTrack(__pendingTrack, true); }
  else __music.ensure();
}
function musicSetState(s) { __pendingState = s; if (__music) __music.setState(s); }
function musicSetTrack(id, force) {
  if (!AudioFX.ctx) { __pendingTrack = id; return; }
  if (!force && id === __trackId && __music) return;
  const cfg = TRACKS.find(t => t.id === id) || TRACKS[0];
  __trackId = cfg.id; __pendingTrack = cfg.id;
  const old = __music;
  const next = buildMusic(cfg);
  if (next) { __music = next; __music.setState(__pendingState); if (old) { try { old.fadeOutStop(0.7); } catch (e) { } } }
}
function musicCycleTrack(dir) {
  const n = TRACKS.length, i = TRACKS.findIndex(t => t.id === __trackId);
  const j = (((i < 0 ? 0 : i) + (dir || 1)) % n + n) % n;
  musicSetTrack(TRACKS[j].id, true);
  return TRACKS[j].name;
}

export {
  AudioFX, TRACKS, trackForWorld, buildMusic, musicEnsure, musicSetState,
  musicSetTrack, musicCycleTrack,
};
