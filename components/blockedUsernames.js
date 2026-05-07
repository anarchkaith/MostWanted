export const BLOCKED_REPORTED_USERNAMES = ['-kaith_suki-'];

export const BLOCKED_REPORTED_USERNAME_MESSAGE = 'Ese usuario no puede reportarse debido a directivas de la comunidad.';

export function normalizeReportedUsername(username = '') {
  return String(username).trim().toLowerCase();
}

export function isBlockedReportedUsername(username = '') {
  return BLOCKED_REPORTED_USERNAMES.includes(normalizeReportedUsername(username));
}