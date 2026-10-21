import { buildApiUrl } from './apiConfig.js';

export async function fetchSession({ signal } = {}) {
  const response = await fetch(buildApiUrl('/auth/me'), { credentials: 'include', signal });
  if (response.status === 401) return { authenticated: false, user: null, capabilities: { manageCases: false } };
  if (!response.ok) throw new Error(`No se pudo consultar la sesión (HTTP ${response.status}).`);
  const payload = await response.json();
  if (typeof payload?.authenticated !== 'boolean' || (payload.authenticated && !payload.user?.id)) {
    throw new Error('El servidor devolvió una sesión inválida.');
  }
  return payload;
}

export async function logoutSession() {
  const response = await fetch(buildApiUrl('/auth/logout'), { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error(`No se pudo cerrar la sesión (HTTP ${response.status}).`);
}
