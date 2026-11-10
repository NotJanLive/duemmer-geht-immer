import { createPublicKey, verify, KeyObject } from 'crypto';
import { IncomingMessage, ServerResponse } from 'http';
import { SCREEN_LABELS } from '../src/types/game';
import { config } from './config';
import { leaderboard, playerStats } from './db';
import { discordBot } from './discord';
import { liveInfo } from './show';

// Slash commands over Discord's HTTP interactions endpoint
// (POST /api/discord/interactions). No gateway connection needed.

const COMMANDS = [
  {
    name: 'stats',
    description: 'Quiz-Stats eines Spielers',
    options: [{ type: 6, name: 'spieler', description: 'Wessen Stats? Leer = deine', required: false }],
  },
  { name: 'bestenliste', description: 'Die ewige Bestenliste der Quizshow' },
  { name: 'quiz', description: 'Läuft gerade eine Quizshow?' },
];

const BLUE = 0x2563eb;
let publicKey: KeyObject | null = null;

export async function setupBot() {
  if (!config.botToken || !config.clientId || !config.guildId) return;
  try {
    const app = await discordBot<{ verify_key: string }>('GET', '/applications/@me');
    const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(app.verify_key, 'hex')]);
    publicKey = createPublicKey({ key: der, format: 'der', type: 'spki' });
    await discordBot('PUT', `/applications/${config.clientId}/guilds/${config.guildId}/commands`, COMMANDS);
  } catch (err) {
    console.error('Bot setup failed:', err);
  }
}

export function isInteractionRequest(url: string): boolean {
  return url === '/api/discord/interactions';
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 100_000) req.destroy();
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const fmt = (n: number, digits = 0) => n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const site = () => config.publicUrl;

function statsEmbed(userId: string) {
  const s = playerStats(userId);
  if (!s || s.shows === 0) return { description: 'Noch keine Quizshow gespielt.', color: BLUE };
  const t = s.tally;
  const lines = [
    `**Siege:** ${s.wins}   **Podest:** ${s.podiums}   **Shows:** ${s.shows}`,
    `**Ø Platz:** ${fmt(s.avgPlace, 1)}   **Ø Punkte:** ${fmt(s.points / s.shows)}   **Bestwert:** ${s.bestTotal}`,
  ];
  if (t.wwmSeen) lines.push(`**Millionär:** ${fmt((t.wwmCorrect / t.wwmSeen) * 100)} % richtig`);
  if (t.geoGuesses) lines.push(`**Wo liegt das?:** Ø ${fmt(t.geoKm / t.geoGuesses)} km daneben`);
  if (t.jeoCorrect + t.jeoWrong) lines.push(`**Jeopardy:** ${t.jeoCorrect} richtig, ${t.jeoWrong} falsch`);
  if (t.picSolved) lines.push(`**Bildrätsel:** ${t.picSolved} erkannt`);
  if (t.songSeen) lines.push(`**Songrätsel:** ${t.songSolved ?? 0} von ${t.songSeen} erkannt`);
  return {
    title: s.name,
    url: `${site()}/stats/${s.id}`,
    thumbnail: s.avatar ? { url: s.avatar } : undefined,
    description: lines.join('\n'),
    color: BLUE,
  };
}

function leaderboardEmbed() {
  const rows = leaderboard().slice(0, 10);
  if (!rows.length) return { description: 'Noch keine Quizshow gespielt.', color: BLUE };
  const medal = ['🥇', '🥈', '🥉'];
  return {
    title: 'Bestenliste',
    url: `${site()}/stats`,
    description: rows
      .map((r, i) => `${medal[i] ?? `\`${i + 1}.\``} **${r.name}**: ${r.wins} ${r.wins === 1 ? 'Sieg' : 'Siege'}, ${r.podiums}× Podest, Ø ${fmt(r.avgPoints)} P`)
      .join('\n'),
    color: BLUE,
  };
}

function liveEmbed() {
  const live = liveInfo();
  if (!live.active) return { description: 'Gerade läuft keine Quizshow.', color: BLUE };
  return {
    title: 'Quizshow läuft',
    url: `${site()}/show`,
    description: `${live.playerIds?.length ?? 0} Spieler · ${live.screen ? SCREEN_LABELS[live.screen] : ''}\n[Jetzt beitreten](${site()}/show)`,
    color: BLUE,
  };
}

export async function handleInteraction(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST' || !publicKey) return json(res, 404, {});
  const body = await readBody(req);
  const sig = String(req.headers['x-signature-ed25519'] ?? '');
  const ts = String(req.headers['x-signature-timestamp'] ?? '');
  let ok = false;
  try {
    ok = verify(null, Buffer.concat([Buffer.from(ts), body]), publicKey, Buffer.from(sig, 'hex'));
  } catch {}
  if (!ok) return json(res, 401, { error: 'bad signature' });

  const i = JSON.parse(body.toString('utf8')) as {
    type: number;
    data?: { name: string; options?: { name: string; value: string }[] };
    member?: { user: { id: string } };
    user?: { id: string };
  };
  if (i.type === 1) return json(res, 200, { type: 1 });
  if (i.type !== 2 || !i.data) return json(res, 400, {});

  const caller = i.member?.user.id ?? i.user?.id ?? '';
  let embed;
  if (i.data.name === 'stats') embed = statsEmbed(i.data.options?.find((o) => o.name === 'spieler')?.value ?? caller);
  else if (i.data.name === 'bestenliste') embed = leaderboardEmbed();
  else embed = liveEmbed();
  return json(res, 200, { type: 4, data: { embeds: [embed], allowed_mentions: { parse: [] } } });
}
