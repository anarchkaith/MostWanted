import { buildApiUrl } from './apiConfig';

export async function requestCase(path, { method = 'GET', body, signal } = {}) {
  const response = await fetch(buildApiUrl(`/cases${path}`), {
    method,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`El servicio de expedientes devolvió una respuesta no válida (HTTP ${response.status}).`);
  }
  if (!response.ok || payload.ok === false) throw new Error(payload.error || 'No se pudo consultar el expediente.');
  return payload;
}
