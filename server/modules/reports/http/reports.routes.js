import { checkReportsHealth } from '../services/reportsHealth.service.js';
import { submitWordpressReport } from '../services/submitReport.service.js';
import { getSessionUser, requireSessionAuth, requirePrivateSession } from '../../../shared/auth/sessionAuth.js';
import { getOwnedReports } from '../services/ownedReports.service.js';
import { canViewPrivateAccounts } from '../../../shared/auth/accountAdmin.js';
import { getAccountDashboard, parseDashboardQuery } from '../services/accountDashboard.service.js';
import { searchArchive } from '../services/archiveSearch.service.js';
import { editReport } from '../services/editReport.service.js';
import { accessReportData } from '../services/reportReads.service.js';

/**
 * Registra endpoints de salud, alta de reporte y antecedentes por jugador.
 */
export function registerReportsRoutes(app, deps) {
  const {
    wordpressReportsConfig,
    discordWebhookUrl,
    rateLimits,
    requireNonEmptyBody,
    refreshPlayerCase,
  } = deps;

  const reportEdit = inspect => async (req, res) => {
    const result = await editReport({
      config: wordpressReportsConfig, user: getSessionUser(req), reportId: req.params.id,
      body: req.body, inspect, refreshPlayerCase,
    });
    return res.status(result.status).json(result.payload);
  };
  const privateReport = (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    return requireSessionAuth(req, res, next);
  };
  app.get('/api/reports/:id/edit', rateLimits.general, privateReport, reportEdit(true));
  app.post('/api/reports/:id/edit', rateLimits.webhook, privateReport, requireNonEmptyBody, reportEdit(false));

  app.get('/api/reports/search', rateLimits.general, requirePrivateSession, async (req, res) => {
    const result = await searchArchive({
      config: wordpressReportsConfig, query: req.query.q, page: req.query.page ?? 1,
    });
    return res.status(result.status).json(result.payload);
  });

  app.get('/api/admin/accounts', rateLimits.general, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!getSessionUser(req)) return res.status(401).json({ ok: false, error: 'auth_required' });
    if (!canViewPrivateAccounts(getSessionUser(req))) return res.status(403).json({ ok: false, error: 'admin_required' });
    let filters;
    try {
      filters = parseDashboardQuery(req.query);
    } catch {
      return res.status(400).json({ ok: false, error: 'Filtros de administración inválidos.' });
    }
    try {
      const payload = await getAccountDashboard({ config: wordpressReportsConfig, sessionStore: deps.sessionStore, filters });
      return res.json(payload);
    } catch (error) {
      console.error('[private-accounts] Lookup failed:', error);
      return res.status(502).json({ ok: false, error: 'No se pudo cargar el panel. Comprueba el backend y el plugin WordPress 0.6.15 o posterior.' });
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

  app.post('/api/reports', rateLimits.webhook, requirePrivateSession, requireNonEmptyBody, async (req, res) => {
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

  app.get('/api/reports/player-insights', rateLimits.general, requirePrivateSession, async (req, res) => {
    const result = await accessReportData({
      config: wordpressReportsConfig, username: req.query.username || '', rid: req.query.rid || '',
    });
    return res.status(result.status).json(result.payload);
  });
  app.get('/api/reports/:id', rateLimits.general, requirePrivateSession, async (req, res) => {
    const result = await accessReportData({ config: wordpressReportsConfig, reportId: req.params.id });
    return res.status(result.status).json(result.payload);
  });
  app.post('/api/reports/:id/community-verification', rateLimits.general, requirePrivateSession, requireNonEmptyBody, async (req, res) => {
    const result = await accessReportData({
      config: wordpressReportsConfig, reportId: req.params.id, user: getSessionUser(req),
      vote: { voteType: req.body.voteType, reason: req.body.reason || '', voterName: req.body.voterName || '' },
    });
    return res.status(result.status).json(result.payload);
  });
}
