/** Short sounds synthesised with Web Audio (oscillator + envelope): no audio files, no licences. */
let audio: AudioContext | undefined;

function context(): AudioContext | undefined {
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    return audio;
  } catch {
    return undefined;
  }
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'triangle', volume = 0.15) {
  const ctx = context();
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

const semitone = (base: number, steps: number) => base * 2 ** (steps / 12);

export const sfx = {
  /** Rises a semitone with each answer in the combo, up to an octave. */
  correct(combo: number) {
    const base = semitone(523.25, Math.min(Math.max(combo - 1, 0), 12));
    tone(base, 0, 0.12);
    tone(semitone(base, 7), 0.07, 0.16);
  },
  wrong() {
    tone(196, 0, 0.18, 'sine', 0.12);
    tone(165, 0.1, 0.22, 'sine', 0.12);
  },
  levelUp() {
    [0, 4, 7, 12].forEach((step, i) => tone(semitone(523.25, step), i * 0.11, 0.3, 'square', 0.08));
  },
};
