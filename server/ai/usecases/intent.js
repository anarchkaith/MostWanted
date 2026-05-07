import { getAssistantReply, requestAiGenerate } from '../client.js';
import { toSafeText } from '../utils.js';
import { ALLOWED_TOOLS } from '../toolCatalog.js';

const TOOL_CATALOG = {
  GENERAL_RESPONSE: 'general_response',
  READ_ALL_REPORTS: 'read_all_reports',
  GET_REPORT_DETAIL: 'get_report_detail',
  ANALYZE_RECENT_SIMILARITY: 'analyze_recent_similarity',
};

function parseIntentPayload(rawText) {
  const text = toSafeText(rawText, '');
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  return null;
}

function toComparableText(input) {
  const lower = toSafeText(input, '').toLowerCase();
  if (!lower) return '';

  const normalized = lower.normalize('NFD');
  let clean = '';

  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) continue;
    clean += ch;
  }

  return clean;
}

function parseRelatedValue(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;

  const text = toComparableText(value);
  return text === 'true' || text === 'si' || text === 'yes' || text === '1';
}

function parseIntentType(value, fallback = 'general') {
  const text = toSafeText(value, '').trim().toLowerCase();
  if (text === 'reportes-query' || text === 'general') {
    return text;
  }
  return fallback;
}

function parseTool(value) {
  const text = toSafeText(value, '').trim().toLowerCase();
  if (ALLOWED_TOOLS.has(text)) {
    return text;
  }
  return TOOL_CATALOG.GENERAL_RESPONSE;
}

function sanitizeParams(input) {
  const source = input && typeof input === 'object' ? input : {};

  const usuario = toSafeText(source.usuario, '').trim();
  const reportId = toSafeText(source.reportId, '').trim();
  const recentDaysRaw = Number(source.recentDays);
  const recentDays = Number.isFinite(recentDaysRaw)
    ? Math.max(1, Math.min(60, Math.round(recentDaysRaw)))
    : null;

  return {
    usuario: usuario || null,
    reportId: reportId || null,
    recentDays,
  };
}

function sanitizeCandidateUsuarios(input) {
  if (!Array.isArray(input)) return [];

  const unique = [];

  for (const item of input) {
    const usuario = toSafeText(item, '').trim();
    if (!usuario) continue;
    if (!unique.some((existing) => toComparableText(existing) === toComparableText(usuario))) {
      unique.push(usuario);
    }
    if (unique.length >= 100) {
      break;
    }
  }

  return unique;
}

function findMentionedUsuario(query, candidateUsuarios = []) {
  const comparableQuery = toComparableText(query);
  if (!comparableQuery) return null;

  let bestMatch = null;

  for (const usuario of candidateUsuarios) {
    const comparableUsuario = toComparableText(usuario);
    if (!comparableUsuario) continue;

    const compactUsuario = comparableUsuario.replace(/\s+/g, '_');
    const matched = comparableQuery.includes(comparableUsuario) || comparableQuery.includes(compactUsuario);
    if (!matched) continue;

    if (!bestMatch || comparableUsuario.length > toComparableText(bestMatch).length) {
      bestMatch = usuario;
    }
  }

  return bestMatch;
}

function looksLikeRankingQuery(query) {
  const text = toComparableText(query);
  if (!text) return false;

  const rankingHints = [
    'top',
    'ranking',
    'mas reportados',
    'mas denunciados',
    'lista de usuarios',
    'usuarios reportados',
    'usuarios mas reportados',
    'dame el top',
  ];

  return rankingHints.some((hint) => text.includes(hint));
}

function buildFallbackIntent(query, candidateUsuarios = []) {
  const mentionedUsuario = findMentionedUsuario(query, candidateUsuarios);

  if (looksLikeRankingQuery(query)) {
    return {
      needsReportContext: true,
      related: true,
      intentType: 'reportes-query',
      tool: TOOL_CATALOG.READ_ALL_REPORTS,
      params: {
        usuario: null,
        reportId: null,
        recentDays: null,
      },
      confidence: 82,
      reason: 'Consulta detectada como ranking/listado de usuarios reportados.',
    };
  }

  if (mentionedUsuario) {
    return {
      needsReportContext: true,
      related: true,
      intentType: 'reportes-query',
      tool: TOOL_CATALOG.GET_REPORT_DETAIL,
      params: {
        usuario: mentionedUsuario,
        reportId: null,
        recentDays: null,
      },
      confidence: 72,
      reason: `El prompt menciona al usuario reportado ${mentionedUsuario}.`,
    };
  }

  return {
    needsReportContext: false,
    related: false,
    intentType: 'general',
    tool: TOOL_CATALOG.GENERAL_RESPONSE,
    params: {
      usuario: null,
      reportId: null,
      recentDays: null,
    },
    confidence: 0,
    reason: 'Clasificador IA no disponible; el usuario debe proporcionarlo directamente o activar el servicio IA.',
  };
}

function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter((m) => {
      const role = toSafeText(m?.role, '');
      const content = toSafeText(m?.content, '').trim();
      return (role === 'user' || role === 'assistant') && content.length > 0;
    })
    .slice(-6)
    .map((m) => ({
      role: toSafeText(m.role, 'user'),
      content: toSafeText(m.content, '').slice(0, 400),
    }));
}

export async function executeIntentUseCase({ config, body }) {
  const query = toSafeText(body?.query, '');
  const candidateUsuarios = sanitizeCandidateUsuarios(body?.candidateUsuarios);
  const history = sanitizeHistory(body?.history);

  if (!query) {
    return {
      ok: true,
      status: 200,
      payload: {
        needsReportContext: false,
        related: false,
        intentType: 'general',
        tool: TOOL_CATALOG.GENERAL_RESPONSE,
        params: {
          usuario: null,
          reportId: null,
          recentDays: null,
        },
        confidence: 0,
        reason: 'Consulta vacia.',
      },
    };
  }

  const prompt = [
    'Eres un pre-analizador de intención para enrutar herramientas de Most Wanted.',
    'Lee el prompt del usuario y determina:',
    '1. Si necesita contexto de reportes (needsReportContext).',
    '2. Qué herramienta usar para mejor responder.',
    '',
    'Herramientas disponibles:',
    '- general_response: para preguntas generales, charla, ayuda sin depender de datos de reportes.',
    '- read_all_reports: para resúmenes globales, estadísticas, listados, estado general de la base de reportes.',
    '- get_report_detail: para información puntual sobre un usuario reportado específico o un reporte individual.',
    '- analyze_recent_similarity: para detectar patrones, similitudes, correlaciones entre reportes.',
    '',
    'Contexto de datos disponibles:',
    candidateUsuarios.length > 0
      ? `Usuarios reportados en el sistema: ${candidateUsuarios.join(', ')}.`
      : 'No hay usuarios reportados disponibles.',
    '',
    'Responde en JSON con esta estructura exacta:',
    '{"needsReportContext": boolean, "related": boolean, "intentType": "reportes-query"|"general", "tool": "general_response"|"read_all_reports"|"get_report_detail"|"analyze_recent_similarity", "params": {"usuario": string|null, "reportId": string|null, "recentDays": number|null}, "confidence": number(0-100), "reason": string}',
    '',
    'Instrucciones de análisis:',
    '- Analiza semánticamente qué quiere el usuario, no busques palabras clave.',
    '- Si el usuario pregunta sobre algo ajeno a reportes, usa general_response.',
    '- Si menciona un usuario reportado de la lista, usa get_report_detail con ese usuario.',
    '- Si pregunta por resumen, total, conteos, comparativas de reportes → read_all_reports.',
    '- Si quiere detectar patrones o similitudes entre reportes → analyze_recent_similarity.',
    '- Si pide detalles de un reporte específico pero no mencionaste usuario, usa read_all_reports.',
    '- Usa null para parámetros que no apliquen.',
    '- La confianza debe reflejar cuánto seguro estás en tu análisis.',
    '',
    ...(history.length > 0
      ? [
        'Historial reciente de la conversación (contexto adicional):',
        ...history.map((m) => `  [${m.role === 'user' ? 'Usuario' : 'H.E.X.'}]: ${m.content}`),
        '',
      ]
      : []),
    `Última consulta del usuario: ${query}`,
  ].join('\n');

  const upstreamResult = await requestAiGenerate({
    config,
    payload: {
      model: config.model,
      prompt,
      stream: false,
    },
    timeoutMs: 3500,
  });

  if (!upstreamResult.ok) {
    const fallback = buildFallbackIntent(query, candidateUsuarios);
    return {
      ok: true,
      status: 200,
      payload: {
        needsReportContext: fallback.needsReportContext,
        related: fallback.related,
        intentType: fallback.intentType,
        tool: fallback.tool,
        params: fallback.params,
        confidence: fallback.confidence,
        reason: fallback.reason,
        provider: null,
        degraded: true,
      },
    };
  }

  const assistantText = getAssistantReply(upstreamResult.payload || {});
  const parsed = parseIntentPayload(assistantText) || {};

  const confidenceRaw = Number(parsed.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(100, Math.max(0, Math.round(confidenceRaw)))
    : 55;
  const parsedTool = parseTool(parsed.tool);
  const needsReportContext = typeof parsed.needsReportContext === 'undefined'
    ? parsedTool !== TOOL_CATALOG.GENERAL_RESPONSE
    : parseRelatedValue(parsed.needsReportContext);
  const related = typeof parsed.related === 'undefined'
    ? needsReportContext
    : parseRelatedValue(parsed.related);
  const intentType = parseIntentType(parsed.intentType, needsReportContext ? 'reportes-query' : 'general');
  const rankingQuery = looksLikeRankingQuery(query);
  const resolvedTool = rankingQuery && needsReportContext
    ? TOOL_CATALOG.READ_ALL_REPORTS
    : parsedTool;

  return {
    ok: true,
    status: 200,
    payload: {
      needsReportContext,
      related,
      intentType,
      tool: needsReportContext ? resolvedTool : TOOL_CATALOG.GENERAL_RESPONSE,
      params: sanitizeParams(parsed.params),
      confidence,
      reason: toSafeText(parsed.reason, '').slice(0, 240),
      provider: upstreamResult.provider || null,
    },
  };
}
