import { config } from './config';
import { getUser, markAwarded, previousWinners, winCount, ShowRecord } from './db';
import { stripWinTag, toRoman } from '../src/types/stats';

// Discord REST calls: OAuth login, server membership, and the bot's winner role
// and nickname tag.

const API = 'https://discord.com/api/v10';

export interface DiscordMember {
  nick: string | null;
  avatar: string | null;
  roles: string[];
  user: { id: string; username: string; global_name: string | null; avatar: string | null };
}

async function bot<T>(method: string, route: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: {
      Authorization: `Bot ${config.botToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'X-Audit-Log-Reason': 'Dümmer geht immer',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Discord ${method} ${route}: ${res.status} ${await res.text()}`);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function avatarUrl(userId: string, hash: string | null, memberHash?: string | null): string | null {
  if (memberHash) return `https://cdn.discordapp.com/guilds/${config.guildId}/users/${userId}/avatars/${memberHash}.png?size=128`;
  if (hash) return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=128`;
  return null;
}

export function memberName(m: DiscordMember): string {
  return stripWinTag(m.nick || m.user.global_name || m.user.username).slice(0, 32) || m.user.username;
}

// OAuth

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: `${config.publicUrl}/auth/callback`,
    scope: 'identify guilds.members.read',
    state,
    prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

// Exchanges the code and returns the member of our server, or null when the
// user is not on it.
export async function memberFromCode(code: string): Promise<DiscordMember | null> {
  const tokenRes = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.publicUrl}/auth/callback`,
    }),
  });
  if (!tokenRes.ok) throw new Error(`OAuth token: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const res = await fetch(`${API}/users/@me/guilds/${config.guildId}/member`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Member lookup: ${res.status} ${await res.text()}`);
  return (await res.json()) as DiscordMember;
}

// Host

let ownerId: string | null = null;

export async function loadGuildOwner() {
  if (!config.botToken || !config.guildId) return;
  try {
    const guild = await bot<{ owner_id: string }>('GET', `/guilds/${config.guildId}`);
    ownerId = guild.owner_id;
  } catch (err) {
    console.error('Could not load the server owner:', err);
  }
}

export function isHostId(id: string): boolean {
  return config.hostIds.length ? config.hostIds.includes(id) : id === ownerId;
}

// Winner role and "[II]" tag

export function taggedNick(base: string, wins: number): string {
  const tag = ` [${toRoman(wins)}]`;
  return stripWinTag(base).slice(0, 32 - tag.length).trimEnd() + tag;
}

async function fetchMember(id: string): Promise<DiscordMember | null> {
  try {
    return await bot<DiscordMember>('GET', `/guilds/${config.guildId}/members/${id}`);
  } catch {
    return null;
  }
}

// Gives the winners the role and their win count as a roman numeral behind
// their name. The previous winners lose the role. Errors are logged, not thrown:
// the bot may lack permissions (for example, nobody can rename the server owner).
export async function awardWinners(show: ShowRecord) {
  if (!config.botToken || !config.guildId) return;
  const role = config.winnerRoleId;
  const plan: string[] = [];

  for (const id of previousWinners(show.id)) {
    if (!show.winners.includes(id) && role) plan.push(`remove role ${id}`);
  }
  for (const id of show.winners) {
    plan.push(`winner ${id} -> ${toRoman(winCount(id))}`);
  }
  if (!config.botWinner) {
    console.log(`[bot] BOT_WINNER is off, would do: ${plan.join(', ')}`);
    markAwarded(show.id);
    return;
  }

  for (const id of previousWinners(show.id)) {
    if (show.winners.includes(id) || !role) continue;
    await bot('DELETE', `/guilds/${config.guildId}/members/${id}/roles/${role}`).catch((e) => console.error('[bot]', e.message));
  }
  for (const id of show.winners) {
    if (role) await bot('PUT', `/guilds/${config.guildId}/members/${id}/roles/${role}`).catch((e) => console.error('[bot]', e.message));
    const member = await fetchMember(id);
    const base = member ? member.nick || member.user.global_name || member.user.username : getUser(id)?.name;
    if (!base) continue;
    await bot('PATCH', `/guilds/${config.guildId}/members/${id}`, { nick: taggedNick(base, winCount(id)) }).catch((e) =>
      console.error('[bot] nickname', e.message),
    );
  }
  markAwarded(show.id);
}

export { bot as discordBot };
