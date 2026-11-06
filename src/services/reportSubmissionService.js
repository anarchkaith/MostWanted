import { buildApiUrl } from './apiConfig.js';
import { readApiResponse } from './jsonResponse.js';

export async function uploadImageToImgbb(image, apiKey) {
  const imageName = image?.name || 'evidence';
  const contentType = image?.type || 'image/png';
  const size = Number(image?.size) || 0;

  if (typeof image?.preview === 'string' && image.preview.startsWith('http')) {
    return {
      url: image.preview,
      name: imageName,
      contentType,
      size,
    };
  }

  const form = new FormData();
  form.append('key', apiKey);
  form.append('image', String(image?.base64 || image?.preview || '').replace(/^data:image\/\w+;base64,/, ''));

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });

  const payload = await readApiResponse(response, `No se pudo publicar la evidencia ${imageName}.`);

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    throw new Error(`No se pudo publicar la evidencia ${image?.name || ''}`.trim());
  }

  return {
    url: payload.data.url,
    name: image?.name || payload?.data?.title || imageName,
    contentType,
    size,
  };
}

export async function uploadEvidenceImages(images = [], apiKey = '') {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  if (!apiKey) {
    throw new Error('Falta configurar VITE_API_KEY_IMGBB para publicar evidencias.');
  }

  const results = await Promise.allSettled(images.map((image) => uploadImageToImgbb(image, apiKey)));
  const failed = results.flatMap((result, index) => result.status === 'rejected'
    ? [`${images[index]?.name || `Evidencia ${index + 1}`}: ${result.reason?.message || 'Error de subida'}`] : []);
  if (failed.length) {
    throw new Error(`No se creo el reporte porque fallaron evidencias: ${failed.join('; ')}. Corrige los archivos o vuelve a intentar.`);
  }
  return results.map(result => result.value);
}

async function postReportToBackend(path, { report, reporter, evidence }) {
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report,
      reporter,
      evidence,
      source: 'mostwanted-web',
    }),
  });

  const payload = await readApiResponse(response, 'Error al enviar el reporte al backend.');
  if (payload.ok !== true) throw new Error('El servidor no confirmó el guardado del reporte.');
  return payload;
}

export async function submitWordpressReport({ report, reporter, evidence }) {
  return postReportToBackend('/reports', { report, reporter, evidence });
}

export async function fetchReportById({ reportId, signal }, buildUrl = buildApiUrl) {
  const response = await fetch(buildUrl(`/reports/${reportId}`), {
    credentials: 'include', cache: 'no-store', signal,
  });
  const payload = await readApiResponse(response, 'No se pudo consultar el reporte.');
  if (payload.ok !== true || Number(payload.report?.id) !== Number(reportId)) throw new Error('El servidor devolvio un reporte invalido.');
  return payload.report;
}

export async function fetchWordpressPlayerInsights({ username = '', rid = '', signal } = {}, buildUrl = buildApiUrl) {
  const params = new URLSearchParams();
  if (username) params.set('username', username);
  if (rid) params.set('rid', String(rid));

  const endpoint = buildUrl(`/reports/player-insights?${params}`);
  const response = await fetch(endpoint, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json' },
  });

  const payload = await readApiResponse(response, 'No se pudieron consultar los insights en WordPress.');
  return payload?.player ?? null;
}

export async function submitWordpressCommunityVerificationVote({
  reportId,
  voteType,
  reason = '',
  voterName = '',
}, buildUrl = buildApiUrl) {
  const safeReportId = Number(reportId);
  if (!Number.isFinite(safeReportId) || safeReportId <= 0) {
    throw new Error('reportId invalido para verificacion comunitaria.');
  }

  const endpoint = buildUrl(`/reports/${safeReportId}/community-verification`);
  const response = await fetch(endpoint, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      voteType,
      reason,
      voterName,
    }),
  });

  return readApiResponse(response, 'No se pudo registrar la verificacion comunitaria en WordPress.');
}
