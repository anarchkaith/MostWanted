import { requestWordpressPlayerEdit } from '../../../reports/wordpressClient.js';
import { hasWordpressReportsConfig } from '../../../reports/wordpressConfig.js';
import { canViewPrivateAccounts } from '../../../shared/auth/accountAdmin.js';

const ALIAS_LIMIT = 30;
const ALIAS_MAX_LENGTH = 64;
const CHANGE_KEYS = ['aliases', 'activeCrew'];

function normalizeIdentity(identity) {
  if (!identity || typeof identity !== 'object' || Array.isArray(identity)) return null;
  const username = typeof identity.username === 'string' ? identity.username.trim() : '';
  const rid = identity.rid === undefined || identity.rid === null ? '' : String(identity.rid).trim();
  if (rid && !/^\d+$/.test(rid)) return null;
  if (!username && !rid) return null;
  return { username, rid };
}

function validateChanges(changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) return null;
  if (Object.keys(changes).some(key => !CHANGE_KEYS.includes(key))) return null;
  if (!('aliases' in changes) && !('activeCrew' in changes)) return null;
  if ('aliases' in changes) {
    if (!Array.isArray(changes.aliases) || changes.aliases.length > ALIAS_LIMIT) return null;
    if (changes.aliases.some(alias => typeof alias !== 'string' || !alias.trim() || alias.trim().length > ALIAS_MAX_LENGTH)) return null;
  }
  if ('activeCrew' in changes && typeof changes.activeCrew !== 'string') return null;
  return changes;
}

export async function editPlayer({ config, user, body, logger = console }) {
  if (!/^\d+$/.test(String(user?.id || ''))) {
    return { status: 401, payload: { ok: false, error: 'Debes iniciar sesión con Discord.' } };
  }
  if (!canViewPrivateAccounts(user)) {
    return { status: 403, payload: { ok: false, error: 'Solo la administradora puede editar jugadores.' } };
  }
  const identity = normalizeIdentity(body?.identity);
  const changes = validateChanges(body?.changes);
  if (!identity || !changes) {
    return { status: 400, payload: { ok: false, error: 'Datos de jugador o cambios inválidos.' } };
  }
  if (!hasWordpressReportsConfig(config)) {
    return { status: 503, payload: { ok: false, error: 'La edición requiere configurar WordPress.' } };
  }
  try {
    const result = await requestWordpressPlayerEdit({
      config, identity, changes,
      actor: { id: String(user.id), isAdmin: true },
      logger,
    });
    const data = result.payload;
    if (data?.ok !== true || data.found !== true || !data.player) {
      throw new Error('invalid_player_edit_response');
    }
    return { status: 200, payload: { ok: true, player: data.player } };
  } catch (error) {
    logger.error('[reports] No se pudo editar el jugador.', { status: error.status || 0, message: error.message });
    const status = [400, 403, 404].includes(error.status) ? error.status : 502;
    return { status, payload: { ok: false, error: status !== 502 ? error.details : 'No se pudo guardar el jugador. Comprueba la conexión y el plugin WordPress 0.7.6 o posterior.' } };
  }
}
