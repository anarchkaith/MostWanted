import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';

export async function requestReportEdit(reportId, { changes, revision, signal } = {}) {
  const response = await fetch(buildApiUrl(`/reports/${reportId}/edit`), {
    method: changes ? 'POST' : 'GET', credentials: 'include', cache: 'no-store', signal,
    headers: { Accept: 'application/json', ...(changes ? { 'Content-Type': 'application/json' } : {}) },
    ...(changes ? { body: JSON.stringify({ changes, revision }) } : {}),
  });
  const data = await readApiResponse(response, 'No se pudo consultar o editar el reporte.');
  if (data.ok !== true || typeof data.canEdit !== 'boolean'
    || (data.canEdit && (Number(data.report?.id) !== Number(reportId) || typeof data.revision !== 'string'))
    || (changes && !data.canEdit)) {
    throw new Error('El servidor no confirmó los permisos o el guardado del reporte.');
  }
  return data;
}

export function reportEditDraft(report) {
  return {
    nickname: report.nickname || '',
    reason: report.content ?? report.reason ?? '',
    crews: (report.crews || []).map(crew => crew.name).join(', '),
    typesOfInfraction: [...(report.categories || report.typesOfInfraction || [])],
    labels: (report.labels || []).map(label => typeof label === 'string' ? label : label.label),
    rid: report.rid || '',
    aliases: (report.aliases || []).join(', '),
  };
}

export async function saveReportEdits({ values, originalEvidence, images, upload, save, revision }) {
  const uploaded = images.length ? await upload(images) : [];
  if (!Array.isArray(uploaded) || uploaded.length !== images.length) {
    throw new Error('No se subieron todas las evidencias. No se guardaron los cambios.');
  }
  for (const item of uploaded) {
    let url;
    try { url = new URL(item?.url); } catch (cause) {
      if (!(cause instanceof TypeError)) throw cause;
      throw new Error('Una evidencia no tiene una URL válida. No se guardaron los cambios.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La evidencia debe usar HTTP o HTTPS.');
  }
  const changes = {
    nickname: values.nickname.trim(), reason: values.reason, crews: values.crews,
    typesOfInfraction: values.typesOfInfraction, labels: values.labels,
    evidence: [...originalEvidence.map(index => ({ _original: index })), ...uploaded],
  };
  return save({ changes, revision });
}
