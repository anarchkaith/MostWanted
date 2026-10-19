const TOOL_CATALOG_READ_ALL_REPORTS = 'read_all_reports';
const TOOL_CATALOG_REPORT_DETAIL = 'get_report_detail';
const TOOL_CATALOG_ANALYZE_SIMILARITY = 'analyze_recent_similarity';

const REPORT_PATTERN_HINTS = [
  'en comun',
  'patron',
  'patrones',
  'comportamiento',
  'similitud',
  'similares',
  'coincidencias',
  'correlacion',
  'tendencia',
  'tendencias',
  'reincidencia',
  'reincidentes',
  'se repite',
  'comparten',
];

const REPORT_RANKING_HINTS = [
  'top',
  'ranking',
  'mas reportados',
  'mas denunciados',
  'lista de usuarios',
  'usuarios reportados',
  'usuarios mas reportados',
  'dame el top',
];

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function findMentionedUsuario(query, candidateUsuarios = []) {
  const normalizedQuery = normalizeText(query);
  let bestMatch = null;

  for (const rawUsuario of candidateUsuarios) {
    const usuario = String(rawUsuario || '').trim();
    const normalizedUsuario = normalizeText(usuario);
    if (!normalizedUsuario) continue;

    const compactUsuario = normalizedUsuario.replace(/\s+/g, '_');
    if (!normalizedQuery.includes(normalizedUsuario) && !normalizedQuery.includes(compactUsuario)) {
      continue;
    }

    if (!bestMatch || normalizedUsuario.length > normalizeText(bestMatch).length) {
      bestMatch = usuario;
    }
  }

  return bestMatch;
}

function hasHint(text, hints) {
  return hints.some((hint) => text.includes(hint));
}

export function inferReportIntent(query, candidateUsuarios = []) {
  const text = normalizeText(query);
  if (!text) return null;

  const mentionedUsuario = findMentionedUsuario(text, candidateUsuarios);
  const asksForPatterns = hasHint(text, REPORT_PATTERN_HINTS);
  const asksForRanking = hasHint(text, REPORT_RANKING_HINTS);
  const asksAboutReports = /\b(reportes?|reportados?|denuncias|denunciados?|jugadores|usuarios)\b/.test(text);

  let tool = null;
  let reason = '';

  if (asksForPatterns) {
    tool = TOOL_CATALOG_ANALYZE_SIMILARITY;
    reason = 'Consulta de patrones o similitudes: se ejecuta el análisis de reportes.';
  } else if (asksForRanking) {
    tool = TOOL_CATALOG_READ_ALL_REPORTS;
    reason = 'Consulta de ranking: se ejecuta el análisis global de reportes.';
  } else if (mentionedUsuario) {
    tool = TOOL_CATALOG_REPORT_DETAIL;
    reason = `La consulta menciona al usuario reportado ${mentionedUsuario}.`;
  } else if (asksAboutReports) {
    tool = TOOL_CATALOG_READ_ALL_REPORTS;
    reason = 'Consulta sobre reportes: se ejecuta el análisis global de reportes.';
  }

  if (!tool) return null;

  return {
    needsReportContext: true,
    related: true,
    intentType: 'reportes-query',
    tool,
    params: {
      usuario: tool === TOOL_CATALOG_REPORT_DETAIL ? mentionedUsuario : null,
      reportId: null,
      recentDays: null,
    },
    confidence: 98,
    reason,
  };
}
