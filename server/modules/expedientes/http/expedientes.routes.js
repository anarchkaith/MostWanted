import { getSessionUser, requireSessionAuth } from '../../../shared/auth/sessionAuth.js';
import { createRequireCaseStaff } from '../../../shared/auth/discordStaff.js';
import { submitWordpressReport } from '../../reports/services/submitReport.service.js';
import { getPlayerInsights } from '../../background-investigation/services/playerInsights.service.js';
import {
  addVoteToExpediente,
  createOrAppendReport,
  findExpedienteByPlayer,
  getExpedienteById,
  searchExpedientes,
  publicLegacyExpediente,
} from '../services/expedientesStore.service.js';

/**
 * Resuelve datos del reportante desde sesion Discord o desde el body.
 */
function resolveReporter(req, body = {}) {
  const sessionUser = getSessionUser(req);
  if (sessionUser) {
    return {
      id: sessionUser.id || '',
      name: sessionUser.username || sessionUser.globalName || 'discord-user',
      tag: sessionUser.discriminator && sessionUser.discriminator !== '0'
        ? `${sessionUser.username}#${sessionUser.discriminator}`
        : (sessionUser.username || ''),
    };
  }

  const bodyReporter = body?.reporter || {};
  return {
    id: bodyReporter.id || '',
    name: bodyReporter.name || 'anonimo',
    tag: bodyReporter.tag || '',
  };
}

/**
 * Registra endpoints de investigacion, gestion de expedientes y votacion.
 */
export function registerExpedientesRoutes(app, deps) {
  const {
    rootDir,
    rateLimits,
    requireBodyObject,
    wordpressReportsConfig,
    getReportesSnapshot,
    buildPlayerInsightsWithScCache,
    verifyCaseStaff,
    refreshPlayerCase,
  } = deps;
  const requireLegacyNoteStaff = createRequireCaseStaff(verifyCaseStaff);
  const authorizeLegacyNotes = (req, res, next) => {
    if (typeof req.body?.notes !== 'string' || !req.body.notes.trim()) return next();
    if (req.body.notes.trim().length > 10000) return res.status(400).json({ ok: false, error: 'invalid_note_text' });
    return requireLegacyNoteStaff(req, res, next);
  };

  app.get('/api/players/investigate', rateLimits.general, async (req, res) => {
    const username = typeof req.query?.username === 'string' ? req.query.username.trim() : '';
    const rid = typeof req.query?.rid === 'string' ? req.query.rid.trim() : '';

    if (!username && !rid) {
      return res.status(400).json({
        ok: false,
        error: 'Debes enviar username o rid para investigar al jugador.',
      });
    }

    try {
      const insightsPayload = await getPlayerInsights({
        rootDir,
        username,
        rid,
        getReportesSnapshot,
        buildPlayerInsightsWithScCache,
      });
      const expediente = findExpedienteByPlayer({ rootDir, username, rid });

      return res.status(200).json({
        ok: true,
        investigation: insightsPayload,
        expediente: publicLegacyExpediente(expediente),
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        error: 'No se pudo completar la investigacion del jugador.',
        details: error instanceof Error ? error.message : 'fallo desconocido',
      });
    }
  });

  app.post('/api/expedientes/report', rateLimits.webhook, requireSessionAuth, requireBodyObject, authorizeLegacyNotes, async (req, res) => {
    const reporter = resolveReporter(req, req.body);

    const result = createOrAppendReport({
      rootDir,
      body: req.body,
      reporter,
    });

    let delivery = null;
    if (req.body?.forwardToReportsApi === true) {
      delivery = await submitWordpressReport({
        body: req.body,
        wordpressReportsConfig,
        logger: console,
        refreshPlayerCase,
      });
    }

    return res.status(201).json({
      ok: true,
      expediente: publicLegacyExpediente(result.expediente),
      appendedReport: publicLegacyExpediente({ reports: [result.appendedReport] }).reports[0],
      createdExpediente: result.created,
      delivery,
    });
  });

  app.get('/api/expedientes/search', rateLimits.general, (req, res) => {
    const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
    const limit = Number(req.query?.limit);

    const items = searchExpedientes({
      rootDir,
      query,
      limit,
    });

    return res.status(200).json({
      ok: true,
      total: items.length,
      items: items.map(publicLegacyExpediente),
    });
  });

  app.get('/api/expedientes/:expedienteId', rateLimits.general, (req, res) => {
    const expedienteId = String(req.params?.expedienteId || '').trim();
    const expediente = getExpedienteById({ rootDir, expedienteId });

    if (!expediente) {
      return res.status(404).json({
        ok: false,
        error: 'expediente_not_found',
      });
    }

    return res.status(200).json({
      ok: true,
      expediente: publicLegacyExpediente(expediente),
    });
  });

  app.post('/api/expedientes/:expedienteId/vote', rateLimits.general, requireBodyObject, (req, res) => {
    const expedienteId = String(req.params?.expedienteId || '').trim();
    const voteType = req.body?.voteType;
    const reason = req.body?.reason;
    const voter = resolveReporter(req, req.body);

    const result = addVoteToExpediente({
      rootDir,
      expedienteId,
      voteType,
      reason,
      voter,
    });

    if (!result.ok) {
      const status = result.error === 'expediente_not_found' ? 404 : 400;
      return res.status(status).json({
        ok: false,
        error: result.error,
      });
    }

    return res.status(200).json({
      ok: true,
      expediente: publicLegacyExpediente(result.expediente),
    });
  });
}
