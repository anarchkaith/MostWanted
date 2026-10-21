export async function readApiResponse(response, fallbackMessage) {
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(`${fallbackMessage} El servidor no devolvió JSON válido (HTTP ${response.status}).`);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${fallbackMessage} La respuesta del servidor tiene un formato inválido.`);
  }
  if (!response.ok || payload.ok === false) {
    const message = [payload.message, payload.error].find(value => typeof value === 'string' && value.trim());
    throw new Error(message || `${fallbackMessage} (HTTP ${response.status}).`);
  }
  return payload;
}
