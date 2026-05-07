import fs from 'node:fs';
import path from 'node:path';

export function readReportes(rootDir) {
  const filePath = path.join(rootDir, 'data', 'reportes.json');
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findReporteByUsuario(reportes, usuario) {
  const target = String(usuario || '').trim().toLowerCase();
  if (!target) return null;

  return reportes.find((reporte) => String(reporte?.usuario || '').trim().toLowerCase() === target) || null;
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

export function getRelatedReportes(reportes, targetReport, limit = 5) {
  const baseTokens = new Set([
    ...tokenize(targetReport?.motivo),
    ...tokenize(targetReport?.usuario),
    ...tokenize(targetReport?.categoria),
  ]);

  const scored = reportes
    .filter((item) => item && item.id !== targetReport?.id)
    .map((item) => {
      const itemTokens = new Set([
        ...tokenize(item?.motivo),
        ...tokenize(item?.usuario),
        ...tokenize(item?.categoria),
      ]);

      let overlap = 0;
      for (const token of baseTokens) {
        if (itemTokens.has(token)) {
          overlap += 1;
        }
      }

      if (item?.categoria && item.categoria === targetReport?.categoria) {
        overlap += 2;
      }

      if (item?.severidad && item.severidad === targetReport?.severidad) {
        overlap += 1;
      }

      return { item, overlap };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, limit)
    .map((entry) => entry.item);

  return scored;
}

export function buildReportesStats(reportes) {
  const byCategory = {};
  const bySeverity = {};

  for (const reporte of reportes) {
    const category = String(reporte?.categoria || 'sin_categoria');
    const severity = String(reporte?.severidad || 'sin_severidad');
    byCategory[category] = (byCategory[category] || 0) + 1;
    bySeverity[severity] = (bySeverity[severity] || 0) + 1;
  }

  return {
    total: reportes.length,
    byCategory,
    bySeverity,
  };
}

// Caché simple con TTL para evitar lecturas repetidas en cada request.
const _cache = { data: null, expiresAt: 0 };
const CACHE_TTL_MS = 30_000;

export function getReportesSnapshot(rootDir) {
  if (_cache.data && Date.now() < _cache.expiresAt) {
    return _cache.data;
  }
  _cache.data = readReportes(rootDir);
  _cache.expiresAt = Date.now() + CACHE_TTL_MS;
  return _cache.data;
}
