import { getWordpressReportsPage } from '../reports/wordpressClient.js';
import { publicReport } from '../modules/expedientes/services/caseReports.service.js';

const CACHE_TTL_MS = 60_000;
const PER_PAGE = 100;
const MAX_PAGES = 50;

function toHexReporte(report) {
  const labels = (report.labels || [])
    .map((label) => (typeof label === 'string' ? label : label.label || label.name))
    .filter(Boolean)
    .slice(0, 8);

  return {
    id: report.id,
    usuario: report.nickname,
    rid: report.rid,
    categoria: report.categories.join(', '),
    motivo: report.reason,
    fecha: report.createdAt || '',
    etiquetas: labels,
  };
}

/**
 * Fuente de reportes para HEX: pagina todos los reportes publicados en WordPress.
 * Si WordPress no está configurado o falla, usa `fallback` (snapshot local) sin cachearlo.
 */
export function createWordpressReportesSource({
  config,
  fallback = () => [],
  logger = console,
  fetchPage = getWordpressReportsPage,
  cacheTtlMs = CACHE_TTL_MS,
  now = Date.now,
}) {
  let cache = { data: null, expiresAt: 0 };
  let inflight = null;

  const loadAll = async () => {
    const reports = [];
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const { payload } = await fetchPage({ config, page, perPage: PER_PAGE, logger });
      if (payload?.ok === false || !Array.isArray(payload?.items)) {
        throw new Error('wordpress_reports_invalid_payload');
      }
      reports.push(...payload.items.map(publicReport).map(toHexReporte));
      const hasMore = typeof payload.hasMore === 'boolean' ? payload.hasMore : payload.items.length === PER_PAGE;
      if (!hasMore) return reports;
    }
    throw new Error('wordpress_reports_pagination_limit');
  };

  return async function getReportesForAi() {
    if (cache.data && now() < cache.expiresAt) return cache.data;
    if (!config?.enabled || !config?.baseUrl || !config?.apiSecret) return fallback();

    if (!inflight) {
      inflight = loadAll()
        .then((reports) => {
          cache = { data: reports, expiresAt: now() + cacheTtlMs };
          return reports;
        })
        .catch((error) => {
          logger.warn?.('[hex] No se pudieron cargar reportes de WordPress, usando snapshot local', {
            message: error?.message,
          });
          return null;
        })
        .finally(() => {
          inflight = null;
        });
    }

    const reports = await inflight;
    return reports ?? fallback();
  };
}
