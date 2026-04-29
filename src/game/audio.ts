let audioCtx: AudioContext | null = null;
let audioEnabled = false;

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

function playOscillator(freq: number, type: OscillatorType, duration = 0.12, volume = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled) return;
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
  if (!ctx || !audioEnabled) return;
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

export function playSound(name: string, volume = 1) {
  // Map semantic names to simple synth calls
  try {
    switch (name) {
      case "place":
        // plucky short harp-like pluck
        playArpeggio([880, 1320], "sine", 0.03, 0.08, 0.12 * volume);
        playNoise(0.06, 0.02 * volume);
        break;
      case "spawn":
        // rising sparkly arpeggio
        playArpeggio([440, 660, 880], "sawtooth", 0.06, 0.12, 0.12 * volume);
        break;
      case "hit":
        // sharp click + small noise
        playOscillator(1600, "square", 0.03, 0.14 * volume);
        playNoise(0.06, 0.04 * volume);
        break;
      case "defender_shoot":
        // bright metallic shot
        playArpeggio([1400, 1700], "square", 0.02, 0.06, 0.18 * volume);
        playNoise(0.04, 0.03 * volume);
        break;
      case "defender_melee":
        // low punch with short click
        playChord([200, 320], "triangle", 0.14, 0.26 * volume);
        playNoise(0.06, 0.06 * volume);
        break;
      case "basophil_release":
        // filtered noise sweep + gentle tone
        playNoise(0.26, 0.14 * volume);
        playArpeggio([800, 720, 660], "sine", 0.06, 0.12, 0.06 * volume);
        break;
      case "monocyte_land":
        // heavy impact + short sub-rumble
        playChord([90, 160], "sine", 0.36, 0.36 * volume);
        playNoise(0.22, 0.16 * volume);
        break;
      case "mine_explode":
        // sharp explosion with detuned stack
        playChord([240, 300, 360], "sawtooth", 0.28, 0.28 * volume);
        playNoise(0.28, 0.26 * volume);
        break;
      case "platelet_explode":
        // sweeping fiery blast
        playChord([260, 340], "sine", 0.32, 0.28 * volume);
        playNoise(0.32, 0.22 * volume);
        break;
      case "pathogen_die":
        // glassy twinkle
        playArpeggio([960, 720, 1200], "triangle", 0.04, 0.12, 0.12 * volume);
        playNoise(0.08, 0.06 * volume);
        break;
      case "defender_die":
        // descending sad chirp
        playArpeggio([600, 480, 360], "triangle", 0.08, 0.16, 0.12 * volume);
        playNoise(0.18, 0.12 * volume);
        break;
      case "collect":
        // pleasant ascending shimmer
        playArpeggio([1000, 1200, 1400], "sine", 0.05, 0.12, 0.14 * volume);
        break;
      case "wave_start":
        playChord([440, 660, 880], "sine", 0.28, 0.18 * volume);
        break;
      case "win":
        // triumphant arpeggiated chord
        playArpeggio([660, 880, 1100, 1320], "sine", 0.06, 0.22, 0.18 * volume);
        playChord([440, 660, 880], "sawtooth", 0.6, 0.12 * volume);
        break;
      case "lose":
        // dissonant low rumble + descending cluster
        playNoise(0.6, 0.36 * volume);
        playArpeggio([220, 196, 174, 130], "triangle", 0.09, 0.28, 0.18 * volume);
        break;
      case "ui_click":
        // short click
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

export default {
  playSound,
  enableAudio,
  isAudioEnabled,
  playBackground,
  stopBackground,
  isBackgroundPlaying,
};

// Background music implementation
let bgInterval: number | null = null;
let bgPlaying = false;
let bgGain: GainNode | null = null;

export function isBackgroundPlaying() {
  return bgPlaying;
}

function playNoteAtTime(freq: number, type: OscillatorType, dur = 0.3, vol = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled) return;
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

function playChord(notes: number[], type: OscillatorType, dur = 0.6, vol = 0.12) {
  const ctx = ensureCtx();
  if (!ctx || !audioEnabled) return;
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
  if (!ctx || !audioEnabled) return;
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

export function playBackground(volume = 0.18) {
  const ctx = ensureCtx();
  if (!ctx) return;
  if (!audioEnabled) enableAudio();
  if (bgPlaying) return;
  bgGain = ctx.createGain();
  bgGain.gain.value = volume;
  bgGain.connect(ctx.destination);

  // Simple sequenced loop
  const melody = [440, 0, 523.25, 0, 392, 0, 493.88, 0]; // A4, rest, C5, rest, G4, rest, B4
  const bass = [110, 110, 98, 98];
  let mi = 0;
  let bi = 0;
  const stepMs = 400;
  bgInterval = window.setInterval(() => {
    const note = melody[mi % melody.length];
    if (note > 0) playNoteAtTime(note, "sine", 0.35, 0.08);
    // Bass on every other step
    if (bi % 2 === 0) playNoteAtTime(bass[(bi / 2) % bass.length], "triangle", 0.6, 0.12);
    // soft rhythmic click
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
