// Settings from the environment. IDs are not secret; tokens come from Drone secrets.

const env = process.env;

export const config = {
  publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  sessionSecret: env.SESSION_SECRET || '',
  clientId: env.DISCORD_CLIENT_ID || '',
  clientSecret: env.DISCORD_CLIENT_SECRET || '',
  botToken: env.DISCORD_BOT_TOKEN || '',
  // Main server: host, bot commands, winner role.
  guildId: env.DISCORD_GUILD_ID || '',
  // Every server whose members may log in (comma separated), the main one included.
  loginGuildIds: [env.DISCORD_GUILD_ID, ...(env.DISCORD_EXTRA_GUILD_IDS || '').split(',')].map((s) => (s ?? '').trim()).filter(Boolean),
  winnerRoleId: env.DISCORD_WINNER_ROLE_ID || '',
  // Comma separated. Empty means the owner of the Discord server.
  hostIds: (env.HOST_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  // Role and nickname changes only happen where this is "on" (production).
  botWinner: env.BOT_WINNER === 'on',
  // Test logins without Discord. Never set this in production.
  devLogin: env.DEV_LOGIN === 'on',
};

export const secureCookies = config.publicUrl.startsWith('https://');

if (!config.sessionSecret) {
  console.warn('SESSION_SECRET is not set, logins are disabled.');
}
