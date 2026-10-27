import { postWordpressAccountActivity } from '../../reports/wordpressClient.js';

export function privateIdentity(user) {
  if (!/^\d+$/.test(String(user?.id || ''))) return null;
  return Object.fromEntries(['id', 'username', 'globalName', 'avatar', 'email']
    .map(key => [key, typeof user[key] === 'string' ? user[key] : '']));
}

export async function publishAccountActivity({ config, user, event, logger = console }) {
  const identity = privateIdentity(user);
  if (!identity) return false;
  try {
    const result = await postWordpressAccountActivity({ config, identity, event, logger });
    if (result.payload.ok !== true) throw new Error('account_activity_not_saved');
    return true;
  } catch (error) {
    logger.error('[account-activity] No se pudo guardar la actividad privada:', error);
    return false;
  }
}
