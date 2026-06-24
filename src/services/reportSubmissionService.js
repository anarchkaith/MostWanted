import { buildApiUrl } from './apiConfig';

const DEFAULT_WORDPRESS_API_BASE_URL = 'https://kaithsrebels.com';

function getWordpressApiBaseUrl() {
  const configured = String(import.meta.env.VITE_WORDPRESS_API_BASE_URL || '').trim();
  return (configured || DEFAULT_WORDPRESS_API_BASE_URL).replace(/\/+$/, '');
}

function extractBase64Payload(dataUrl = '') {
  return String(dataUrl).replace(/^data:image\/\w+;base64,/, '');
}

function inferContentType(image = {}) {
  const explicitType = typeof image?.type === 'string' ? image.type.trim().toLowerCase() : '';
  if (explicitType) return explicitType;

  const name = String(image?.name || '').toLowerCase();

  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.webp')) return 'image/webp';

  return '';
}

async function uploadImageToImgbb(image, apiKey) {
  if (typeof image?.preview === 'string' && image.preview.startsWith('http')) {
    return {
      url: image.preview,
      name: image.name || 'evidence',
      contentType: inferContentType(image) || 'image/png',
      size: Number.isFinite(image.size) ? image.size : 0,
    };
  }

  const form = new FormData();
  form.append('key', apiKey);
  form.append('image', extractBase64Payload(image?.base64 || image?.preview || ''));

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload?.success || !payload?.data?.url) {
    throw new Error(`No se pudo publicar la evidencia ${image?.name || ''}`.trim());
  }

  return {
    url: payload.data.url,
    name: image?.name || payload.data.title || 'evidence',
    contentType: inferContentType(image) || 'image/png',
    size: Number.isFinite(image?.size) ? image.size : 0,
  };
}

export async function uploadEvidenceImages(images = [], apiKey = '') {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }

  if (!apiKey) {
    throw new Error('Falta configurar VITE_API_KEY_IMGBB para publicar evidencias.');
  }

  return Promise.all(images.map((image) => uploadImageToImgbb(image, apiKey)));
}

export async function submitReportToBackend({ report, reporter, evidence }) {
  const response = await fetch(buildApiUrl('/reports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      report,
      reporter,
      evidence,
      source: 'mostwanted-web',
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || 'Error al enviar el reporte al backend.');
  }

  return payload;
}

export async function fetchWordpressPlayersSnapshot({ perPage = 100, reportsLimit = 20 } = {}) {
  const safePerPage = Number.isFinite(perPage) ? Math.max(1, Math.min(100, Number(perPage))) : 100;
  const safeReportsLimit = Number.isFinite(reportsLimit) ? Math.max(1, Math.min(100, Number(reportsLimit))) : 20;

  const endpoint = `${getWordpressApiBaseUrl()}/wp-json/mostwanted/v1/players?per_page=${safePerPage}&with_reports=1&reports_limit=${safeReportsLimit}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'No se pudo consultar la API de jugadores de WordPress.');
  }

  return payload;
}

export async function fetchWordpressReportsSnapshot({ perPage = 100, page = 1 } = {}) {
  const safePerPage = Number.isFinite(perPage) ? Math.max(1, Math.min(100, Number(perPage))) : 100;
  const safePage = Number.isFinite(page) ? Math.max(1, Number(page)) : 1;

  const endpoint = `${getWordpressApiBaseUrl()}/wp-json/mostwanted/v1/reports?per_page=${safePerPage}&page=${safePage}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'No se pudo consultar la API de reportes de WordPress.');
  }

  return payload;
}

export async function submitWordpressCommunityVerificationVote({
  reportId,
  voteType,
  reason = '',
  voterId = '',
  voterName = '',
}) {
  const safeReportId = Number(reportId);
  if (!Number.isFinite(safeReportId) || safeReportId <= 0) {
    throw new Error('reportId invalido para verificacion comunitaria.');
  }

  const endpoint = `${getWordpressApiBaseUrl()}/wp-json/mostwanted/v1/reports/${safeReportId}/community-verification`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      voteType,
      reason,
      voterId,
      voterName,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'No se pudo registrar la verificacion comunitaria en WordPress.');
  }

  return payload;
}
