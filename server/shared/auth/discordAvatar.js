import { buildDiscordAvatarUrl } from '../../../shared/discordAvatar.js';
export { buildDiscordAvatarUrl } from '../../../shared/discordAvatar.js';

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
