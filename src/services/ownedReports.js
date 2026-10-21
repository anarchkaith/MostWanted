import { readApiResponse } from './jsonResponse.js';

export async function fetchOwnedReports({ endpoint, page = 1, signal, request = fetch }) {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('La página debe ser un entero positivo.');
  const response = await request(`${endpoint}?page=${page}`, {
    credentials: 'include', cache: 'no-store', signal,
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) {
    throw new Error('El backend no tiene disponible la consulta de mis reportes (HTTP 404). Es necesario desplegar la versión actualizada del backend con /api/reports/mine y el plugin WordPress 0.6.4 o posterior.');
  }
  const payload = await readApiResponse(response, 'No se pudieron consultar tus reportes.');
  if (payload.ok !== true || !Array.isArray(payload.items) || typeof payload.hasMore !== 'boolean' ||
      payload.items.some(report => !report || !Number.isSafeInteger(report.id) || report.id < 1 ||
        typeof report.nickname !== 'string' || !Array.isArray(report.categories) ||
        report.categories.some(category => typeof category !== 'string'))) {
    throw new Error('El servidor devolvió un listado de reportes con un formato inválido.');
  }
  return payload;
}
