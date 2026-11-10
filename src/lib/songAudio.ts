'use client';

// Plays exact snippets of a song preview with Web Audio, so 0.2 s really is
// 0.2 s and every device starts at the same server time. The preview is
// fetched once and decoded; the same data gives the waveform bars.

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
let current: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

const VOLUME_KEY = 'dgi_song_volume';

export function songContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

// Browsers only allow audio after a click; call this from one.
export function unlockSongAudio() {
  const c = songContext();
  if (c && c.state === 'suspended') void c.resume();
}

export function songAudioReady(): boolean {
  return songContext()?.state === 'running';
}

export function getVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return Number.isFinite(v) && localStorage.getItem(VOLUME_KEY) !== null ? Math.min(1, Math.max(0, v)) : 0.8;
  } catch {
    return 0.8;
  }
}

export function setVolume(v: number) {
  try {
    localStorage.setItem(VOLUME_KEY, String(v));
  } catch {}
  if (current) current.gain.gain.value = v;
}

export function loadSong(url: string): Promise<AudioBuffer> {
  const c = songContext();
  if (!c) return Promise.reject(new Error('no audio'));
  if (!buffers.has(url)) {
    buffers.set(
      url,
      fetch(url)
        .then((r) => r.arrayBuffer())
        .then((data) => c.decodeAudioData(data))
        .catch((err) => {
          buffers.delete(url);
          throw err;
        }),
    );
  }
  return buffers.get(url)!;
}

export function stopSong() {
  if (!current) return;
  try {
    current.source.stop();
  } catch {}
  current = null;
}

// Plays `duration` seconds from `offset` at local time `atMs` (Date.now based).
// `catchUp`: starting late skips the part that was missed (the long preview
// after the reveal). Without it a late command still plays the whole snippet
// right away (a snippet must stay 0.2 s), unless it is stale (a reconnect).
export async function playSnippet(url: string, offset: number, duration: number, atMs: number, catchUp = false) {
  const c = songContext();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  const buffer = await loadSong(url);
  stopSong();
  const lateSec = (Date.now() - atMs) / 1000;
  if (catchUp ? lateSec >= duration : lateSec > 10) return;
  const skip = catchUp ? Math.max(0, lateSec) : 0;
  const startIn = Math.max(0, -lateSec);
  const len = duration - skip;
  if (len <= 0) return;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const gain = c.createGain();
  // A few milliseconds of fade avoid clicks at the edges.
  const t0 = c.currentTime + startIn;
  const fade = Math.min(0.01, len / 4);
  const v = getVolume();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(v, t0 + fade);
  gain.gain.setValueAtTime(v, t0 + len - fade);
  gain.gain.linearRampToValueAtTime(0, t0 + len);
  source.connect(gain).connect(c.destination);
  source.start(t0, Math.min(buffer.duration - 0.05, offset + skip), len);
  current = { source, gain };
  source.onended = () => {
    if (current?.source === source) current = null;
  };
  return { startedAt: Date.now() + startIn * 1000 - skip * 1000 };
}

// Loudness of `bars` slices between offset and offset + seconds, 0..1.
export async function waveform(url: string, offset: number, seconds: number, bars: number): Promise<number[]> {
  const buffer = await loadSong(url);
  const data = buffer.getChannelData(0);
  const from = Math.floor(offset * buffer.sampleRate);
  const per = Math.max(1, Math.floor((seconds * buffer.sampleRate) / bars));
  const out: number[] = [];
  for (let b = 0; b < bars; b++) {
    let sum = 0;
    const start = from + b * per;
    for (let i = start; i < Math.min(start + per, data.length); i += 16) sum += data[i] * data[i];
    out.push(Math.sqrt(sum / (per / 16)));
  }
  const max = Math.max(...out, 1e-6);
  return out.map((v) => v / max);
}
