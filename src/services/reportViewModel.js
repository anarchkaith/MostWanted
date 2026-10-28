import { normalizeReportSeverity, normalizeReportValidation } from './casePresentation.js';
import { resolvePlayerRid } from '../../shared/playerIdentity.js';

export function mapCategoriaLegacy(categorias = [], categoriaActual = '') {
  if (categoriaActual) return categoriaActual;
  const first = Array.isArray(categorias) ? categorias[0] : '';
  if (first === 'MODDER') return 'modder';
  if (first === 'GRIFFER') return 'griffer';
  return 'ardido';
}

function mapCategoriaFromWordpressType(categories = []) {
  const first = Array.isArray(categories) && categories.length ? String(categories[0]).toUpperCase() : '';
  return mapCategoriaLegacy([first]);
}

export function normalizeComentariosFromCommunityVerification(communityVerification = {}) {
  const confirmations = Array.isArray(communityVerification?.confirmations) ? communityVerification.confirmations : [];
  return confirmations
    .filter(entry => String(entry?.reason || '').trim() !== '')
    .map(entry => ({
      tipo: 'down', comentario: String(entry?.reason || '').trim(),
      autor: 'Comunidad', fecha: new Date().toISOString(),
    }));
}

export function normalizeReportLabels(labels) {
  if (!Array.isArray(labels)) return [];
  return labels.map(item => ({
    label: typeof item === 'string' ? item.trim() : String(item?.label || item?.name || '').trim(),
    detail: typeof item?.detail === 'string' ? item.detail.trim() : '',
  })).filter(item => item.label);
}

export function mapWordpressReportToReporte(report = {}) {
  const evidence = Array.isArray(report?.evidence) ? report.evidence : [];
  const usuario = String(report?.nickname || report?.title || '').trim();
  const communityVerification = report?.communityVerification || {};
  return {
    id: Number(report?.id) || Date.now(),
    usuario: usuario || 'USUARIO_SIN_NOMBRE',
    motivo: report?.content || report?.reason || 'Reporte registrado en MostWanted.',
    reportadoPor: 'ANONIMO',
    categoria: mapCategoriaFromWordpressType(report.categories?.length ? report.categories : report.typesOfInfraction || []),
    fecha: report?.createdAt || report?.date || '',
    time: report.time ?? null,
    investigation_status: report.investigation_status || '',
    evidencia: evidence[0]?.url || '',
    evidencias: evidence.map((item, index) => ({
      id: `${report?.id || 'report'}-evidence-${index}`,
      preview: item?.url || '',
      nombre: item?.name || `Evidencia ${index + 1}`,
      tipo: item?.contentType || 'image/png',
    })).filter(item => item.preview),
    estado: 'activo',
    severidad: normalizeReportSeverity(report?.severidad || report?.severity || report.analysis?.severity || report.analysis?.severidad),
    validacion: normalizeReportValidation(report?.validacion || report?.validation),
    votos: {
      up: Number(communityVerification?.up) || 0,
      down: Number(communityVerification?.down) || 0,
      comentarios: normalizeComentariosFromCommunityVerification(communityVerification),
    },
    wpRid: resolvePlayerRid(report),
    aliases: Array.isArray(report.aliases) ? report.aliases : [],
    crews: Array.isArray(report.crews) ? report.crews : [],
    avatar1: report.avatar1 || '',
    avatar2: report.avatar2 || '',
    categories: Array.isArray(report.categories) && report.categories.length
      ? report.categories : Array.isArray(report.typesOfInfraction) ? report.typesOfInfraction : [],
    labels: normalizeReportLabels(report.labels || report.etiquetas),
  };
}

export function normalizeReporte(reporte = {}) {
  return {
    ...reporte,
    id: reporte.id ?? Date.now(),
    usuario: reporte.usuario || 'USUARIO_SIN_NOMBRE',
    categoria: mapCategoriaLegacy(reporte.categorias, reporte.categoria),
    severidad: normalizeReportSeverity(reporte.severidad),
    labels: normalizeReportLabels(reporte.labels || reporte.etiquetas),
    fecha: reporte.fecha ?? new Date().toISOString().slice(0, 10),
    reportadoPor: 'ANONIMO',
    validacion: reporte.validacion ?? 'pendiente',
  };
}
