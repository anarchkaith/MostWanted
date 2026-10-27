import { getWordpressSummarySource, postWordpressPlayerSummary } from '../../../reports/wordpressClient.js';
import { publicReport } from './caseReports.service.js';
import { summaryInput } from './caseSummary.service.js';
import { updateExpedientes } from './expedientesStore.service.js';

export function createCaseSummaryPublisher({ rootDir, config, logger = console }) {
  return async (item) => {
    const summary = item?.aiSummary;
    if (!summary?.text || summary.publishedFingerprint === summary.fingerprint
      || Date.parse(summary.publishRetryAfter) > Date.now()) return item;
    let publicationError = null;
    try {
      const identity = { nickname: item.player.nickname, rid: item.player.rid || '' };
      const result = await getWordpressSummarySource({ config, ...identity, logger });
      if (result.payload.ok !== true || !Array.isArray(result.payload.reports)
        || typeof result.payload.revision !== 'string') throw new Error('wordpress_summary_source_invalid');
      if (JSON.stringify(summaryInput(result.payload.reports.map(publicReport)))
        !== JSON.stringify(summaryInput(item.caseSnapshot.reports))) {
        throw new Error('wordpress_summary_source_changed');
      }
      const delivery = await postWordpressPlayerSummary({
        config, ...identity, text: summary.text, sourceRevision: result.payload.revision, logger,
      });
      if (delivery.payload.ok !== true) throw new Error('wordpress_summary_publication_failed');
    } catch (error) {
      logger.error('[cases] No se pudo publicar el resumen HEX en la metadata del jugador:', error);
      publicationError = 'El resumen HEX esta guardado, pero no se pudo publicar en la metadata del jugador.';
    }
    return updateExpedientes(rootDir, (items) => {
      const current = items.find((entry) => entry.expedienteId === item.expedienteId);
      if (!current || current.aiSummary?.fingerprint !== summary.fingerprint) return current;
      current.aiSummary.publicationError = publicationError;
      current.aiSummary.publishRetryAfter = publicationError ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;
      if (!publicationError) current.aiSummary.publishedFingerprint = summary.fingerprint;
      return current;
    });
  };
}
