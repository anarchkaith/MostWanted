import { checkReportsHealth } from '../services/reportsHealth.service.js';
import { submitWordpressReport } from '../services/submitReport.service.js';
import { getPlayerInsights } from '../../background-investigation/services/playerInsights.service.js';
import { getSessionUser, requireSessionAuth } from '../../../shared/auth/sessionAuth.js';
import { getOwnedReports } from '../services/ownedReports.service.js';
import { canViewPrivateAccounts } from '../../../shared/auth/accountAdmin.js';
import { getWordpressAccounts } from '../../../reports/wordpressClient.js';

/**
 * Registra endpoints de salud, alta de reporte y antecedentes por jugador.
 */
export function registerReportsRoutes(app, deps) {
  const {
    rootDir,
    wordpressReportsConfig,
    discordWebhookUrl,
    rateLimits,
    maybeRequireSessionAuth,
    requireNonEmptyBody,
    getReportesSnapshot,
    buildPlayerInsightsWithScCache,
    refreshPlayerCase,
  } = deps;

  app.get('/api/admin/accounts', rateLimits.general, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!getSessionUser(req)) return res.status(401).json({ ok: false, error: 'auth_required' });
    if (!canViewPrivateAccounts(getSessionUser(req))) return res.status(403).json({ ok: false, error: 'admin_required' });
    const page = Number(req.query.page ?? 1);
    if (!Number.isSafeInteger(page) || page < 1) return res.status(400).json({ ok: false, error: 'invalid_page' });
    try {
      const result = await getWordpressAccounts({ config: wordpressReportsConfig, page });
      if (result.payload.ok !== true || !Array.isArray(result.payload.items) || typeof result.payload.hasMore !== 'boolean') {
        throw new Error('invalid_private_accounts_response');
      }
      return res.json(result.payload);
    } catch (error) {
      console.error('[private-accounts] Lookup failed:', error);
      return res.status(502).json({ ok: false, error: 'No se pudieron consultar las cuentas privadas. Comprueba el backend y el plugin 0.6.14.' });
    }
  });

  app.get('/api/reports/mine', rateLimits.general, (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    return requireSessionAuth(req, res, next);
  }, async (req, res) => {
    const result = await getOwnedReports({
      config: wordpressReportsConfig, userId: getSessionUser(req).id, page: req.query.page ?? 1,
    });
    return res.status(result.status).json(result.payload);
  });

  app.get('/api/reports/health', rateLimits.webhook, async (req, res) => {
    const result = await checkReportsHealth({
      wordpressReportsConfig,
      logger: console,
    });

    return res.status(result.status).json(result.payload);
  });

  app.post('/api/reports', rateLimits.webhook, maybeRequireSessionAuth, requireNonEmptyBody, async (req, res) => {
    const result = await submitWordpressReport({
      body: req.body,
      sessionUser: getSessionUser(req),
      wordpressReportsConfig,
      discordWebhookUrl,
      logger: console,
      refreshPlayerCase,
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
