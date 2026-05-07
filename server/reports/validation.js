function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const ALLOWED_EVIDENCE_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mov',
]);

function sanitizeReporter(reporter = {}, fallbackContact = '') {
  const name = toTrimmedString(reporter?.name) || 'Formulario web';
  const id = toTrimmedString(reporter?.id);
  const tag = toTrimmedString(reporter?.tag) || (fallbackContact && fallbackContact !== name ? fallbackContact : '');
  const email = toTrimmedString(reporter?.email);

  return {
    id,
    name,
    tag,
    email,
  };
}

function sanitizeEvidenceItem(item = {}) {
  return {
    url: toTrimmedString(item?.url),
    name: toTrimmedString(item?.name),
    contentType: toTrimmedString(item?.contentType).toLowerCase(),
    size: Number.isFinite(item?.size) && item.size >= 0 ? item.size : 0,
  };
}

function sanitizeStringArray(values = [], maxItems = 25) {
  if (!Array.isArray(values)) return [];

  return values
    .map((value) => toTrimmedString(value))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeAnalysis(analysis = {}) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    return null;
  }

  const stringFields = [
    'summary',
    'recommendation',
    'reason',
    'operationalRecommendation',
    'tacticalDirective',
    'threatLevel',
    'corruptionReason',
  ];

  const numericFields = [
    'confidence',
    'corruptionPercent',
  ];

  const sanitized = {};

  for (const field of stringFields) {
    const value = toTrimmedString(analysis?.[field]);
    if (value) sanitized[field] = value;
  }

  for (const field of numericFields) {
    const value = Number(analysis?.[field]);
    if (Number.isFinite(value)) sanitized[field] = value;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

export function validateIncomingReportSubmission(body = {}) {
  const report = body?.report && typeof body.report === 'object' && !Array.isArray(body.report)
    ? body.report
    : null;

  if (!report) {
    return {
      ok: false,
      status: 400,
      error: 'El body debe incluir un objeto report.',
    };
  }

  // Nuevos nombres de campo (estructura 13 campos)
  const nickname = toTrimmedString(report?.nickname || report?.usuario || report?.username);
  const reason = toTrimmedString(report?.reason || report?.motivo);
  const reportedby = toTrimmedString(report?.reportedby || report?.contacto);
  const typesOfInfraction = sanitizeStringArray(report?.typesOfInfraction || report?.categorias || report?.categories);
  const labels = sanitizeStringArray(report?.labels || report?.etiquetas || report?.tags);

  // Campos opcionales de información del jugador
  const crews = toTrimmedString(report?.crews);
  const avatar1 = toTrimmedString(report?.avatar1);
  const avatar2 = toTrimmedString(report?.avatar2);
  const rid = Number.isFinite(report?.rid) ? report.rid : null;
  const ip = toTrimmedString(report?.ip);
  const aliases = toTrimmedString(report?.aliases);
  const time = Number.isFinite(report?.time) ? report.time : null;

  const severity = toTrimmedString(report?.severidad || report?.severity);
  const analysis = sanitizeAnalysis(report?.analysis);
  const source = toTrimmedString(body?.source || report?.source) || 'mostwanted-web';
  const rawEvidence = Array.isArray(body?.evidence) ? body.evidence : [];

  // Las evidencias ahora son opcionales (0-5)
  if (rawEvidence.length > 5) {
    return {
      ok: false,
      status: 400,
      error: 'El reporte puede incluir máximo 5 evidencias.',
    };
  }

  const evidence = rawEvidence.map(sanitizeEvidenceItem);

  if (!nickname) {
    return {
      ok: false,
      status: 400,
      error: 'El reporte debe incluir un nickname valido.',
    };
  }

  if (!reason) {
    return {
      ok: false,
      status: 400,
      error: 'El reporte debe incluir un motivo valido.',
    };
  }

  const invalidEvidenceIndex = evidence.findIndex((item) => !item.url || !item.name || !item.contentType);
  if (invalidEvidenceIndex >= 0) {
    return {
      ok: false,
      status: 400,
      error: `La evidencia ${invalidEvidenceIndex + 1} debe incluir url, name y contentType.`,
    };
  }

  const unsupportedContentType = evidence.find((item) => !ALLOWED_EVIDENCE_CONTENT_TYPES.has(item.contentType));
  if (unsupportedContentType) {
    return {
      ok: false,
      status: 400,
      error: `El contentType ${unsupportedContentType.contentType} no esta soportado.`,
    };
  }

  return {
    ok: true,
    value: {
      report: {
        nickname,
        reason,
        ...(crews ? { crews } : {}),
        ...(avatar1 ? { avatar1 } : {}),
        ...(avatar2 ? { avatar2 } : {}),
        ...(rid ? { rid } : {}),
        ...(ip ? { ip } : {}),
        ...(aliases ? { aliases } : {}),
        ...(time ? { time } : {}),
        ...(reportedby ? { reportedby } : {}),
        ...(typesOfInfraction.length > 0 ? { typesOfInfraction } : {}),
        ...(labels.length > 0 ? { labels } : {}),
        ...(severity ? { severity } : {}),
        ...(analysis ? { analysis } : {}),
      },
      reporter: sanitizeReporter(body?.reporter, reportedby),
      evidence,
      source,
    },
  };
}
