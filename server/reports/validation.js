import { TIPOS_ETIQUETAS } from '../shared/constants/tiposEtiquetas.js';

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function toObjectText(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const keys = ['nombre', 'name', 'label', 'value', 'text', 'title'];
  for (const key of keys) {
    const candidate = value?.[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return '';
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

const ALLOWED_INVESTIGATION_STATUSES = new Set([
  'not_attempted',
  'pending',
  'resolved',
  'not_found',
]);

const LABEL_ID_BY_NAME = TIPOS_ETIQUETAS.reduce((acc, tipo) => {
  for (const etiqueta of tipo?.etiquetas || []) {
    const normalizedLabel = toTrimmedString(etiqueta?.nombre).toLowerCase();
    if (!normalizedLabel || acc.has(normalizedLabel)) continue;
    acc.set(normalizedLabel, acc.size + 1);
  }
  return acc;
}, new Map());

function sanitizeReporter(reporter = {}, fallbackContact = '') {
  const contactName = toTrimmedString(fallbackContact);
  const name = toTrimmedString(reporter?.name) || contactName || 'Anónimo';
  const id = toTrimmedString(reporter?.id);
  const email = toTrimmedString(reporter?.email);

  return {
    id,
    name,
    email,
  };
}

function sanitizeAliases(value = '') {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => toTrimmedString(item)).filter(Boolean))).slice(0, 50);
  }

  const text = toTrimmedString(value);
  if (!text) return [];

  return Array.from(new Set(text
    .split(/[;,|]/)
    .map((item) => toTrimmedString(item))
    .filter(Boolean))).slice(0, 50);
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
    .map((value) => {
      if (typeof value === 'string') return toTrimmedString(value);
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return toObjectText(value);
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeLabels(values = [], maxItems = 25) {
  if (!Array.isArray(values)) {
    return { labels: [], labelIds: [] };
  }

  const labels = [];
  const labelIds = [];

  for (const rawValue of values) {
    if (labels.length + labelIds.length >= maxItems) break;

    if (Number.isInteger(rawValue) && rawValue > 0) {
      labelIds.push(rawValue);
      continue;
    }

    let textValue = toTrimmedString(rawValue);
    if (!textValue && rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
      textValue = toObjectText(rawValue);

      const objectId = Number(rawValue?.id ?? rawValue?.labelId ?? rawValue?.valueId);
      if (Number.isInteger(objectId) && objectId > 0) {
        labelIds.push(objectId);
      }
    }

    if (!textValue) continue;

    if (/^\d+$/.test(textValue)) {
      const parsedId = Number(textValue);
      if (Number.isInteger(parsedId) && parsedId > 0) {
        labelIds.push(parsedId);
        continue;
      }
    }

    labels.push(textValue);

    const mappedLabelId = LABEL_ID_BY_NAME.get(textValue.toLowerCase());
    if (Number.isInteger(mappedLabelId) && mappedLabelId > 0) {
      labelIds.push(mappedLabelId);
    }
  }

  return {
    labels: Array.from(new Set(labels)).slice(0, maxItems),
    labelIds: Array.from(new Set(labelIds)).slice(0, maxItems),
  };
}

function sanitizeCrewSlots(report = {}) {
  const slots = [
    toTrimmedString(report?.crew1),
    toTrimmedString(report?.crew2),
    toTrimmedString(report?.crew3),
    toTrimmedString(report?.crew4),
  ].filter(Boolean);

  return Array.from(new Set(slots)).slice(0, 4);
}

function parseCrewEntry(rawValue = '', slot = null, isActive = false) {
  const raw = toTrimmedString(rawValue);
  if (!raw) return null;

  const urlMatch = raw.match(/https?:\/\/\S+/i);
  const url = urlMatch ? toTrimmedString(urlMatch[0]) : '';

  const tagMatch = raw.match(/\[([^\]]{1,12})\]/);
  const tag = tagMatch ? toTrimmedString(tagMatch[1]).toUpperCase() : '';

  let name = raw;
  if (url) {
    name = name.replace(url, '');
  }
  if (tagMatch?.[0]) {
    name = name.replace(tagMatch[0], '');
  }

  name = name
    .replace(/[|;,-]+$/g, '')
    .replace(/^[|;,-]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!name && tag) {
    name = `Crew ${tag}`;
  }

  return {
    raw,
    name,
    ...(tag ? { tag } : {}),
    ...(url ? { url } : {}),
    ...(Number.isInteger(slot) ? { slot } : {}),
    isActive,
  };
}

function buildCrewStructures({ crewCurrent = '', crewSlots = [] } = {}) {
  const activeCrewEntry = parseCrewEntry(crewCurrent, null, true);

  const assignedEntries = crewSlots
    .map((value, index) => parseCrewEntry(value, index + 1, false))
    .filter(Boolean);

  const uniqueByRaw = new Set();
  const allEntries = [];

  for (const entry of [activeCrewEntry, ...assignedEntries].filter(Boolean)) {
    const key = entry.raw.toLowerCase();
    if (uniqueByRaw.has(key)) continue;
    uniqueByRaw.add(key);
    allEntries.push(entry);
  }

  return {
    activeCrewEntry,
    assignedEntries,
    allEntries,
  };
}

function buildCrewLinks(entries = []) {
  const normalized = [];
  const unique = new Set();

  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== 'object') continue;

    const name = toTrimmedString(entry.name) || toTrimmedString(entry.raw);
    if (!name) continue;

    const url = toTrimmedString(entry.url);
    const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
    if (unique.has(key)) continue;
    unique.add(key);

    normalized.push({
      name,
      url,
    });
  }

  return normalized;
}

function buildPlayerId({ nickname = '', rid = null }) {
  if (Number.isFinite(rid) && rid > 0) {
    return `RID-${Math.trunc(rid)}`;
  }

  const normalizedNickname = toTrimmedString(nickname)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');

  return `TMP-${normalizedNickname || 'unknown_player'}`;
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
  const labelsData = sanitizeLabels(report?.labels || report?.etiquetas || report?.tags);
  const labels = labelsData.labels;
  const labelIds = labelsData.labelIds;
  const investigationStatus = toTrimmedString(
    report?.investigation_status || report?.investigationStatus || report?.investigation || 'not_attempted'
  ).toLowerCase();

  // Campos opcionales de información del jugador
  const crews = toTrimmedString(report?.crews);
  const crewCurrent = toTrimmedString(report?.crewCurrent || report?.crew_current);
  const crewSlots = sanitizeCrewSlots(report);
  const avatar1 = toTrimmedString(report?.avatar1);
  const avatar2 = toTrimmedString(report?.avatar2);
  const parsedRid = Number(report?.rid);
  const rid = Number.isFinite(parsedRid) ? parsedRid : null;
  const playerId = buildPlayerId({ nickname, rid });
  const ip = toTrimmedString(report?.ip);
  const aliases = sanitizeAliases(report?.aliases);
  const time = Number.isFinite(report?.time) ? report.time : null;
  const crewStructures = buildCrewStructures({
    crewCurrent,
    crewSlots,
  });
  const fallbackCrewEntries = crews
    ? crews
      .split(/\||,/)
      .map((value) => parseCrewEntry(value, null, false))
      .filter(Boolean)
    : [];
  const crewsCollection = buildCrewLinks([
    ...crewStructures.allEntries,
    ...fallbackCrewEntries,
  ]);

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

  if (!ALLOWED_INVESTIGATION_STATUSES.has(investigationStatus)) {
    return {
      ok: false,
      status: 400,
      error: 'investigation_status invalido.',
    };
  }

  if (investigationStatus !== 'resolved' && investigationStatus !== 'not_found') {
    return {
      ok: false,
      status: 400,
      error: 'Debes completar la investigacion antes de enviar el reporte.',
    };
  }

  if (investigationStatus === 'resolved' && rid === null) {
    return {
      ok: false,
      status: 400,
      error: 'RID obligatorio cuando investigation_status es resolved.',
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
        playerId,
        reason,
        ...(crewCurrent ? { crewCurrent } : {}),
        ...(crewSlots[0] ? { crew1: crewSlots[0] } : {}),
        ...(crewSlots[1] ? { crew2: crewSlots[1] } : {}),
        ...(crewSlots[2] ? { crew3: crewSlots[2] } : {}),
        ...(crewSlots[3] ? { crew4: crewSlots[3] } : {}),
        ...(crewStructures.activeCrewEntry ? { crewCurrentData: crewStructures.activeCrewEntry } : {}),
        ...(crewsCollection.length > 0 ? { crews: crewsCollection } : {}),
        ...(avatar1 ? { avatar1 } : {}),
        ...(avatar2 ? { avatar2 } : {}),
        ...(rid ? { rid } : {}),
        ...(ip ? { ip } : {}),
        ...(aliases.length > 0 ? { aliases } : {}),
        ...(time ? { time } : {}),
        investigation_status: investigationStatus,
        ...(typesOfInfraction.length > 0 ? { typesOfInfraction } : {}),
        ...(labels.length > 0 ? { labels } : {}),
        ...(labelIds.length > 0 ? { labelIds } : {}),
        ...(analysis ? { analysis } : {}),
      },
      reporter: sanitizeReporter(body?.reporter, reportedby),
      evidence,
      source,
    },
  };
}
