import { checkReportsHealth } from '../services/reportsHealth.service.js';
import { submitReport } from '../services/submitReport.service.js';
import { getPlayerInsights } from '../../background-investigation/services/playerInsights.service.js';

/**
 * Registra endpoints de salud, alta de reporte y antecedentes por jugador.
 */
export function registerReportsRoutes(app, deps) {
  const {
    rootDir,
    hexbotConfig,
    wordpressReportsConfig,
    rateLimits,
    maybeRequireSessionAuth,
    requireNonEmptyBody,
    getReportesSnapshot,
    buildPlayerInsightsWithScCache,
  } = deps;

  app.get('/api/reports/health', rateLimits.webhook, async (req, res) => {
    const result = await checkReportsHealth({
      hexbotConfig,
      wordpressReportsConfig,
      logger: console,
    });

    return res.status(result.status).json(result.payload);
  });

  app.post('/api/reports', rateLimits.webhook, maybeRequireSessionAuth, requireNonEmptyBody, async (req, res) => {
    const result = await submitReport({
      body: req.body,
      hexbotConfig,
      wordpressReportsConfig,
      logger: console,
    });

    return res.status(result.status).json(result.payload);
  });

  app.get('/api/reports/player-insights', rateLimits.general, async (req, res) => {
    const result = await getPlayerInsights({
      rootDir,
      username: req.query?.username,
      rid: req.query?.rid,
      getReportesSnapshot,
      buildPlayerInsightsWithScCache,
    });

    return res.status(result.status).json(result.payload);
  });
}
