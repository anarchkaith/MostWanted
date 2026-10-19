/**
 * Cuota diaria de consultas IA por usuario (ID de Discord).
 * El contador vive en memoria: se reinicia si el proceso se reinicia.
 */

export const AI_DAILY_QUOTA_PER_USER = 10;

// El día se calcula en hora de Buenos Aires para que el corte sea a medianoche local.
const QUOTA_TIMEZONE = 'America/Argentina/Buenos_Aires';
const PRUNE_THRESHOLD = 500;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: QUOTA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** @type {Map<string, { day: string, used: number }>} */
const usageByUser = new Map();

/**
 * Descuenta una consulta de la cuota diaria del usuario.
 * @param {string} userId
 * @param {number} [now]
 * @returns {{ allowed: boolean, limit: number, used: number, remaining: number }}
 */
export function consumeAiDailyQuota(userId, now = Date.now()) {
  const day = dayFormatter.format(new Date(now));

  if (usageByUser.size > PRUNE_THRESHOLD) {
    for (const [key, entry] of usageByUser) {
      if (entry.day !== day) usageByUser.delete(key);
    }
  }

  let entry = usageByUser.get(userId);
  if (!entry || entry.day !== day) {
    entry = { day, used: 0 };
    usageByUser.set(userId, entry);
  }

  if (entry.used >= AI_DAILY_QUOTA_PER_USER) {
    return { allowed: false, limit: AI_DAILY_QUOTA_PER_USER, used: entry.used, remaining: 0 };
  }

  entry.used += 1;
  return {
    allowed: true,
    limit: AI_DAILY_QUOTA_PER_USER,
    used: entry.used,
    remaining: AI_DAILY_QUOTA_PER_USER - entry.used,
  };
}
