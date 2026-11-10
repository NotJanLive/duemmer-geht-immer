'use client';

// Small synthesized sounds, no audio files. Browsers only allow audio after a
// click or key press, so the context starts on the first gesture.

export type Sound = 'buzz' | 'correct' | 'wrong' | 'reveal' | 'pop' | 'lock' | 'whoosh' | 'tick' | 'clunk';

const PREF = 'dgi_sound';
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(PREF) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off');
  } catch {}
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(ac: AudioContext, start: number, dur: number, vol: number, from: number, to: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(to, start + dur);
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(vol, start + dur * 0.3);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(start);
}

export function play(sound: Sound) {
  if (!soundOn()) return;
  const ac = audio();
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime + 0.01;
  switch (sound) {
    case 'buzz': // bright quiz bell: two quick chimes
      tone(ac, 987.77, t, 0.5, 'sine', 0.22);
      tone(ac, 1975.5, t, 0.25, 'sine', 0.06);
      tone(ac, 1318.5, t + 0.09, 0.6, 'sine', 0.2);
      tone(ac, 2637, t + 0.09, 0.3, 'sine', 0.05);
      break;
    case 'correct': // rising major arpeggio
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, f, t + i * 0.08, 0.3, 'triangle', 0.18));
      break;
    case 'wrong': // low falling buzz
      tone(ac, 180, t, 0.45, 'sawtooth', 0.12, 90);
      tone(ac, 120, t + 0.05, 0.45, 'square', 0.06, 70);
      break;
    case 'reveal':
      tone(ac, 392, t, 0.12, 'triangle', 0.15);
      tone(ac, 587.33, t + 0.1, 0.25, 'triangle', 0.15);
      break;
    case 'pop':
      tone(ac, 880, t, 0.08, 'sine', 0.18, 1320);
      break;
    case 'lock':
      tone(ac, 1200, t, 0.05, 'square', 0.05);
      break;
    case 'tick': {
      // Slot reel tick: a tiny mechanical click.
      noise(ac, t, 0.018, 0.22, 3500, 1800);
      tone(ac, 1800, t, 0.015, 'square', 0.025);
      break;
    }
    case 'clunk': {
      // Reel stop: low thud plus a click.
      tone(ac, 140, t, 0.18, 'sine', 0.35, 70);
      noise(ac, t, 0.05, 0.3, 1200, 400);
      tone(ac, 660, t + 0.04, 0.12, 'triangle', 0.08);
      break;
    }
    case 'whoosh':
      noise(ac, t, 0.4, 0.15, 400, 3000);
      break;
  }
}
