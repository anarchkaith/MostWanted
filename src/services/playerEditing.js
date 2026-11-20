import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';

export async function savePlayerInsightsEdit({ username = '', rid = '', changes }, { signal } = {}) {
  const response = await fetch(buildApiUrl('/reports/player-insights/edit'), {
    method: 'POST', credentials: 'include', cache: 'no-store', signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: { username, rid }, changes }),
  });
  const data = await readApiResponse(response, 'No se pudo guardar la información del jugador.');
  if (data.ok !== true || !data.player) {
    throw new Error('El servidor no confirmó los cambios del jugador.');
  }
  return data.player;
}
