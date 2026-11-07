import { createRequireCaseStaff } from '../../../shared/auth/discordStaff.js';
import { getSessionUser } from '../../../shared/auth/sessionAuth.js';
import { manageCase, readCase, staffCase } from '../services/cases.service.js';

export function registerCasesRoutes(app, { rootDir, rateLimits, requireBodyObject, verifyCaseStaff, getCaseReports, generateCaseSummary, publishCaseSummary }) {
  const staffAccess = createRequireCaseStaff(verifyCaseStaff);
  const read = async (req, res, query) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const result = await readCase({ rootDir, source: getCaseReports, generateCaseSummary, publishCaseSummary, ...query });
      return res.status(result.status).json(result.payload);
    } catch {
      return res.status(503).json({ ok: false, error: 'case_storage_unavailable' });
    }
  };
  app.get('/api/cases/lookup', rateLimits.general, (req, res) => {
    const nickname = typeof req.query.username === 'string' ? req.query.username.trim() : '';
    const rid = typeof req.query.rid === 'string' ? req.query.rid.trim() : '';
    if ((!nickname && !rid) || nickname.length > 128 || (rid && !/^\d{1,30}$/.test(rid))) {
      return res.status(400).json({ ok: false, error: 'invalid_player_query' });
    }
    return read(req, res, { nickname, rid });
  });
  app.get('/api/cases/:caseId', rateLimits.general, (req, res) => read(req, res, { id: req.params.caseId }));
  app.get('/api/cases/:caseId/staff', rateLimits.general, staffAccess, (req, res) => {
    try {
      const data = staffCase({ rootDir, id: req.params.caseId });
      return res.status(data ? 200 : 404).json(data ? { ok: true, ...data } : { ok: false, error: 'case_not_found' });
    } catch {
      return res.status(503).json({ ok: false, error: 'case_storage_unavailable' });
    }
  });
  const write = (req, res, values) => {
    try {
      const result = manageCase({ rootDir, id: req.params.caseId, user: getSessionUser(req), ...values });
      return res.status(result ? (values.text !== undefined ? 201 : 200) : 404)
        .json(result ? { ok: true, ...result } : { ok: false, error: 'case_not_found' });
    } catch {
      return res.status(503).json({ ok: false, error: 'case_storage_unavailable' });
    }
  };
  app.post('/api/cases/:caseId/notes', rateLimits.general, staffAccess, requireBodyObject, (req, res) => {
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text || text.length > 10000) return res.status(400).json({ ok: false, error: 'invalid_note_text' });
    return write(req, res, { text });
  });
  app.patch('/api/cases/:caseId/status', rateLimits.general, staffAccess, requireBodyObject, (req, res) => {
    const status = req.body.status;
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    if (!['open', 'investigating', 'closed'].includes(status) || !reason || reason.length > 2000) {
      return res.status(400).json({ ok: false, error: 'invalid_case_status_or_reason' });
    }
    return write(req, res, { status, reason });
  });
}
