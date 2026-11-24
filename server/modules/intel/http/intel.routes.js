import { requirePrivateSession } from '../../../shared/auth/sessionAuth.js';

/**
 * Inteligencia unificada del jugador (Social Club, historial de nombres y señales de incongruencia).
 */
export function registerIntelRoutes(app, { rateLimits, getPlayerIntel }) {
  app.get('/api/players/intel', rateLimits.general, requirePrivateSession, async (req, res) => {
    const result = await getPlayerIntel({
      nickname: typeof req.query.username === 'string' ? req.query.username : '',
      rid: typeof req.query.rid === 'string' ? req.query.rid : '',
    });
    return res.status(result.status).json(result.payload);
  });
}
