import { toolExists } from './toolCatalog';

const REPORTES_STORAGE_KEY = 'mostwanted_reportes';

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const toSafeArray = (value) => (Array.isArray(value) ? value : []);

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function pickRelevantFields(reporte = {}) {
  return {
    id: reporte.id ?? null,
    usuario: String(reporte.usuario || 'USUARIO_SIN_NOMBRE').trim(),
    categoria: String(reporte.categoria || '').trim(),
    severidad: String(reporte.severidad || '').trim(),
    motivo: String(reporte.motivo || '').trim(),
    fecha: String(reporte.fecha || '').trim(),
    validacion: String(reporte.validacion || 'pendiente').trim(),
    etiquetas: toSafeArray(reporte.etiquetas).slice(0, 8),
  };
}

function buildStats(reportes = []) {
  return reportes.reduce((acc, reporte) => {
    const categoria = normalizeText(reporte.categoria) || 'sin_categoria';
    const severidad = normalizeText(reporte.severidad) || 'sin_severidad';

    acc.total += 1;
    acc.byCategoria[categoria] = (acc.byCategoria[categoria] || 0) + 1;
    acc.bySeveridad[severidad] = (acc.bySeveridad[severidad] || 0) + 1;

    return acc;
  }, {
    total: 0,
    byCategoria: {},
    bySeveridad: {},
  });
}

function extractTargetUsuario(userText, reportes = []) {
  const question = normalizeText(userText);
  if (!question) return '';

  const found = reportes.find((reporte) => {
    const usuario = normalizeText(reporte.usuario);
    if (!usuario) return false;

    const compact = usuario.replace(/\s+/g, '_');
    return question.includes(usuario) || question.includes(compact);
  });

  return found?.usuario || '';
}

function resolveTool(intentData = {}) {
  const raw = String(intentData?.tool || '').trim().toLowerCase();
  // Validar que la herramienta existe en el catálogo
  if (raw && toolExists(raw)) {
    return raw;
  }
  return 'read_all_reports';
}

function filterRecent(reportes = [], days = 14) {
  const now = Date.now();
  const threshold = now - (days * 24 * 60 * 60 * 1000);

  return reportes.filter((reporte) => {
    const time = Date.parse(reporte.fecha);
    if (!Number.isFinite(time)) return false;
    return time >= threshold;
  });
}

function filterByDetailTarget(reportes = [], intentData = {}, targetUsuario = '') {
  const reportId = String(intentData?.params?.reportId || '').trim();
  const usuarioFromIntent = normalizeText(intentData?.params?.usuario || '');
  const usuarioFallback = normalizeText(targetUsuario);

  if (reportId) {
    return reportes.filter((reporte) => String(reporte.id || '').trim() === reportId);
  }

  const target = usuarioFromIntent || usuarioFallback;
  if (!target) {
    return reportes;
  }

  return reportes.filter((reporte) => normalizeText(reporte.usuario).includes(target));
}

export function readReportesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(REPORTES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(pickRelevantFields)
      .filter((reporte) => reporte.usuario.length > 0);
  } catch {
    return [];
  }
}

export function buildReportesChatContext(userText, intentData = {}) {
  const reportes = readReportesFromLocalStorage();
  const targetUsuario = extractTargetUsuario(userText, reportes);
  const intentNeedsReportContext = typeof intentData?.needsReportContext === 'boolean'
    ? intentData.needsReportContext
    : Boolean(intentData?.related);
  const relatedToReportes = intentNeedsReportContext || Boolean(targetUsuario);

  const tool = resolveTool(intentData);
  const requestedDays = toSafeNumber(intentData?.params?.recentDays, 14);

  const reportQuery = {
    tool,
    usuario: targetUsuario,
    reportId: String(intentData?.params?.reportId || '').trim(),
    recentDays: tool === 'analyze_recent_similarity' ? Math.max(1, Math.min(60, requestedDays)) : null,
  };

  if (!relatedToReportes) {
    return {
      useReportesDb: false,
    };
  }

  if (reportes.length === 0) {
    return {
      useReportesDb: true,
      reportQuery,
      reportesContext: {
        source: 'server-fallback',
        reportes: [],
        targetUsuario,
      },
    };
  }

  const stats = buildStats(reportes);

  const sortedByDate = [...reportes].sort((a, b) => {
    const bTime = Date.parse(b.fecha);
    const aTime = Date.parse(a.fecha);
    return toSafeNumber(bTime) - toSafeNumber(aTime);
  });

  let scopedReportes = sortedByDate;

  if (tool === 'get_report_detail') {
    scopedReportes = filterByDetailTarget(sortedByDate, intentData, targetUsuario);
  } else if (tool === 'analyze_recent_similarity') {
    scopedReportes = filterRecent(sortedByDate, Math.max(1, Math.min(60, requestedDays)));
  }

  return {
    useReportesDb: true,
    reportQuery,
    reportesContext: {
      source: 'localStorage',
      intent: String(intentData?.intentType || 'reportes-query').trim() || 'reportes-query',
      tool,
      reason: String(intentData?.reason || '').trim(),
      intentConfidence: toSafeNumber(intentData?.confidence, 0),
      stats,
      reportes: scopedReportes.slice(0, 40),
      targetUsuario,
    },
  };
}
