/**
 * Consulta el estado remoto de Battleye y normaliza la respuesta basica.
 */
async function fetchBattleyeStatus() {
  const response = await fetch('https://battleye.dudx.info/verify/banLookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challenge: 'c155a4874f79aef14495ed6f008ab3e2086075b4056fa6ba029d41996bfa6c21',
      difficulty: 1000000,
      salt: '5ZOjeTvJTsXTdDR7ztrk',
    }),
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  return { ok: response.ok, status: response.status, payload };
}

/**
 * Registra endpoints tecnicos de BattlEye.
 */
export function registerSystemRoutes(app, deps) {
  const { rateLimits } = deps;

  app.get('/api/battleye-status', rateLimits.general, async (req, res) => {
    try {
      const result = await fetchBattleyeStatus();
      return res.status(result.ok ? 200 : result.status || 502).json(result.payload);
    } catch (error) {
      return res.status(502).json({
        message: 'No se pudo consultar Battleye.',
        detail: error instanceof Error ? error.message : 'fallo desconocido',
      });
    }
  });
}
