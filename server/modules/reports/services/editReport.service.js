import { requestWordpressReportEdit } from '../../../reports/wordpressClient.js';
import { hasWordpressReportsConfig } from '../../../reports/wordpressConfig.js';
import { canViewPrivateAccounts } from '../../../shared/auth/accountAdmin.js';

export async function editReport({ config, user, reportId, body, inspect = false, refreshPlayerCase, logger = console }) {
  if (!/^\d+$/.test(String(user?.id || ''))) {
    return { status: 401, payload: { ok: false, error: 'Debes iniciar sesión con Discord.' } };
  }
  if (!/^[1-9]\d*$/.test(String(reportId)) || !Number.isSafeInteger(Number(reportId))) {
    return { status: 400, payload: { ok: false, error: 'ID de reporte inválido.' } };
  }
  if (!inspect && (!body || typeof body.revision !== 'string' || !body.changes || typeof body.changes !== 'object' || Array.isArray(body.changes))) {
    return { status: 400, payload: { ok: false, error: 'Cambios o revisión del reporte inválidos.' } };
  }
  if (!hasWordpressReportsConfig(config)) {
    return { status: 503, payload: { ok: false, error: 'La edición requiere configurar WordPress.' } };
  }
  try {
    const result = await requestWordpressReportEdit({
      config, reportId: Number(reportId),
      actor: { id: String(user.id), isAdmin: canViewPrivateAccounts(user) },
      ...(!inspect ? { changes: body.changes, revision: body.revision } : {}), logger,
    });
    const data = result.payload;
    if (data?.ok !== true || typeof data.canEdit !== 'boolean'
      || (data.canEdit && (!data.report || Number(data.report.id) !== Number(reportId) || typeof data.revision !== 'string'))
      || (!inspect && !data.canEdit)) {
      throw new Error('invalid_report_edit_response');
    }
    let warning = '';
    if (!inspect && refreshPlayerCase) {
      try {
        await refreshPlayerCase({ nickname: data.report.nickname, rid: data.report.rid || '', reportId: Number(reportId) });
      } catch (error) {
        logger.error('[reports] Edición guardada; no se pudo refrescar HEX.', error);
        warning = 'Los cambios se guardaron, pero la actualización HEX quedó pendiente.';
      }
    }
    return { status: 200, payload: { ...data, ...(warning ? { warning } : {}) } };
  } catch (error) {
    logger.error('[reports] No se pudo editar el reporte.', { status: error.status || 0, message: error.message });
    const status = [400, 403, 409].includes(error.status) || (error.status === 404 && error.code === 'report_not_found')
      ? error.status : 502;
    return { status, payload: { ok: false, error: status !== 502 ? error.details
      : 'No se pudo consultar o guardar el reporte. Comprueba la conexión y el plugin WordPress 0.7.0 o posterior.' } };
  }
}
