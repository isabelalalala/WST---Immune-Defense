let audioCtx: AudioContext | null = null;
let audioEnabled = false;
let musicMuted = false;
let sfxMuted = false;

function ensureCtx() {
  if (!audioCtx && typeof window !== "undefined") {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function enableAudio() {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  audioEnabled = true;
}

export function isAudioEnabled() {
  return audioEnabled;
}

// ─── Music controls ───────────────────────────────────────────────────────────
export function muteMusic() {
  musicMuted = true;
  stopBackground();
}

export function unmuteMusic() {
  musicMuted = false;
  playBackground();
}

export function isMusicMuted() {
  return musicMuted;
}

// ─── SFX controls ─────────────────────────────────────────────────────────────
export function muteSfx() {
  sfxMuted = true;
}

export function unmuteSfx() {
  sfxMuted = false;
}

export function isSfxMuted() {
  return sfxMuted;
}

// ─── Legacy: kept so Game.tsx doesn't break ───────────────────────────────────
export function muteAudio() {
  muteMusic();
  muteSfx();
}

export function unmuteAudio() {
  unmuteMusic();
  unmuteSfx();
}

export function isAudioMuted() {
  return musicMuted && sfxMuted;
}

// ─── Oscillator helpers ───────────────────────────────────────────────────────
function playOscillator(freq: number, type: OscillatorType, duration = 0.12, volume = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled || sfxMuted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = volume;
  o.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  o.start(now);
  g.gain.setValueAtTime(volume, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + duration);
  o.stop(now + duration + 0.02);
}

function playNoise(duration = 0.15, volume = 0.2) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled || sfxMuted) return;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g);
  g.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + duration + 0.02);
}

function playChord(notes: number[], type: OscillatorType, dur = 0.6, vol = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled || sfxMuted) return;
  for (const n of notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = n;
    g.gain.value = vol / notes.length;
    o.connect(g);
    g.connect(bgGain ?? ctx.destination);
    const now = ctx.currentTime;
    o.start(now);
    g.gain.setValueAtTime(vol / notes.length, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    o.stop(now + dur + 0.02);
  }
}

function playArpeggio(notes: number[], type: OscillatorType, step = 0.08, durEach = 0.12, vol = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled || sfxMuted) return;
  let t = 0;
  for (const n of notes) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = n;
    g.gain.value = vol;
    o.connect(g);
    g.connect(bgGain ?? ctx.destination);
    const now = ctx.currentTime + t;
    o.start(now);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + durEach);
    o.stop(now + durEach + 0.02);
    t += step;
  }
}

export function playSound(name: string, volume = 1) {
  try {
    switch (name) {
      case "place":
        playArpeggio([880, 1320], "sine", 0.03, 0.08, 0.12 * volume);
        playNoise(0.06, 0.02 * volume);
        break;
      case "spawn":
        playArpeggio([440, 660, 880], "sawtooth", 0.06, 0.12, 0.12 * volume);
        break;
      case "hit":
        playOscillator(1600, "square", 0.03, 0.14 * volume);
        playNoise(0.06, 0.04 * volume);
        break;
      case "defender_shoot":
        playArpeggio([1400, 1700], "square", 0.02, 0.06, 0.18 * volume);
        playNoise(0.04, 0.03 * volume);
        break;
      case "defender_melee":
        playChord([200, 320], "triangle", 0.14, 0.26 * volume);
        playNoise(0.06, 0.06 * volume);
        break;
      case "basophil_release":
        playNoise(0.26, 0.14 * volume);
        playArpeggio([800, 720, 660], "sine", 0.06, 0.12, 0.06 * volume);
        break;
      case "monocyte_land":
        playChord([90, 160], "sine", 0.36, 0.36 * volume);
        playNoise(0.22, 0.16 * volume);
        break;
      case "mine_explode":
        playChord([240, 300, 360], "sawtooth", 0.28, 0.28 * volume);
        playNoise(0.28, 0.26 * volume);
        break;
      case "platelet_explode":
        playChord([260, 340], "sine", 0.32, 0.28 * volume);
        playNoise(0.32, 0.22 * volume);
        break;
      case "pathogen_die":
        playArpeggio([960, 720, 1200], "triangle", 0.04, 0.12, 0.12 * volume);
        playNoise(0.08, 0.06 * volume);
        break;
      case "defender_die":
        playArpeggio([600, 480, 360], "triangle", 0.08, 0.16, 0.12 * volume);
        playNoise(0.18, 0.12 * volume);
        break;
      case "collect":
        playArpeggio([1000, 1200, 1400], "sine", 0.05, 0.12, 0.14 * volume);
        break;
      case "wave_start":
        playChord([440, 660, 880], "sine", 0.28, 0.18 * volume);
        break;
      case "win":
        playArpeggio([660, 880, 1100, 1320], "sine", 0.06, 0.22, 0.18 * volume);
        playChord([440, 660, 880], "sawtooth", 0.6, 0.12 * volume);
        break;
      case "lose":
        playNoise(0.6, 0.36 * volume);
        playArpeggio([220, 196, 174, 130], "triangle", 0.09, 0.28, 0.18 * volume);
        break;
      case "ui_click":
        playNoise(0.02, 0.04 * volume);
        playOscillator(2200, "square", 0.02, 0.06 * volume);
        break;
      default:
        playOscillator(600, "sine", 0.06, 0.08 * volume);
    }
  } catch (e) {
    // silent failure
  }
}

// ─── Background music ─────────────────────────────────────────────────────────
let bgInterval: number | null = null;
let bgPlaying = false;
let bgGain: GainNode | null = null;

export function isBackgroundPlaying() {
  return bgPlaying;
}

function playNoteAtTime(freq: number, type: OscillatorType, dur = 0.3, vol = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled || musicMuted) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(bgGain ?? ctx.destination);
  const now = ctx.currentTime;
  o.start(now);
  g.gain.setValueAtTime(vol, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.stop(now + dur + 0.02);
}

export function playBackground(volume = 0.18) {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (!audioEnabled) enableAudio();
  if (musicMuted) return;
  if (bgPlaying) return;
  bgGain = ctx.createGain();
  bgGain.gain.value = volume;
  bgGain.connect(ctx.destination);

  const melody = [440, 0, 523.25, 0, 392, 0, 493.88, 0];
  const bass = [110, 110, 98, 98];
  let mi = 0;
  let bi = 0;
  const stepMs = 400;
  bgInterval = window.setInterval(() => {
    const note = melody[mi % melody.length];
    if (note > 0) playNoteAtTime(note, "sine", 0.35, 0.08);
    if (bi % 2 === 0) playNoteAtTime(bass[(bi / 2) % bass.length], "triangle", 0.6, 0.12);
    playNoise(0.06, 0.02);
    mi++;
    bi++;
  }, stepMs);
  bgPlaying = true;
}

export function stopBackground() {
  if (!bgPlaying) return;
  if (bgInterval) {
    clearInterval(bgInterval);
    bgInterval = null;
  }
  if (bgGain) {
    try { bgGain.gain.exponentialRampToValueAtTime(0.0001, (ensureCtx()?.currentTime ?? 0) + 0.3); } catch (e) {}
    bgGain.disconnect();
    bgGain = null;
  }
  bgPlaying = false;
}

export default {
  playSound,
  enableAudio,
  isAudioEnabled,
  playBackground,
  stopBackground,
  isBackgroundPlaying,
  tryAutoplay,
};

// ─── Autoplay: try immediately, fallback to first gesture ─────────────────────
export function tryAutoplay() {
  const ctx = ensureCtx();
  if (!ctx) return;
  audioEnabled = true;

  const start = () => {
    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (!bgPlaying && !musicMuted) playBackground();
      }).catch(() => {});
    } else {
      if (!bgPlaying && !musicMuted) playBackground();
    }
  };

  // Try immediately (works in some browsers / localhost)
  start();

  // Fallback: first user gesture
  if (!bgPlaying) {
    const gesture = ["click", "keydown", "touchstart", "pointerdown"] as const;
    const handler = () => {
      start();
      gesture.forEach(e => document.removeEventListener(e, handler));
    };
    gesture.forEach(e => document.addEventListener(e, handler, { once: true }));
  }
}
