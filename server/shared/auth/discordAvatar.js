const DISCORD_CDN_URL = 'https://cdn.discordapp.com';

/**
 * Construye la URL pública del avatar de un usuario de Discord a partir de su ID y hash.
 * Sin avatar propio, usa el avatar por defecto que Discord asigna según el ID.
 */
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

/**
 * Agrega el avatar de la sesión al reporter solo si coincide con el usuario logueado.
 * No se toma el avatar del cuerpo del request para evitar URLs falsificadas.
 */
export function attachSessionAvatarToReporter(reporter = {}, sessionUser = null) {
  if (!sessionUser || String(sessionUser.id || '') !== String(reporter?.id || '')) {
    return reporter;
  }

  const avatarUrl = buildDiscordAvatarUrl(sessionUser);
  return avatarUrl ? { ...reporter, avatarUrl } : reporter;
}
