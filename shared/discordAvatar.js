const DISCORD_CDN_URL = 'https://cdn.discordapp.com';

export function buildDiscordAvatarUrl({ id = '', avatar = '' } = {}) {
  const userId = String(id || '').trim();
  if (!/^\d+$/.test(userId)) return '';
  const hash = String(avatar || '').trim();
  if (hash) {
    const extension = hash.startsWith('a_') ? 'gif' : 'png';
    return `${DISCORD_CDN_URL}/avatars/${userId}/${hash}.${extension}?size=128`;
  }
  const defaultIndex = Number((BigInt(userId) >> 22n) % 6n);
  return `${DISCORD_CDN_URL}/embed/avatars/${defaultIndex}.png`;
}
