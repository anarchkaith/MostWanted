import { getAssistantReply, requestAiGenerate } from '../client.js';
import { extractJsonObject, parseIntegerOr, toSafeText } from '../utils.js';
import { findReporteByUsuario, getRelatedReportes } from '../../reportes/store.js';

function buildCorrelationInput({ reportes, inputReport, usuario }) {
  const target = inputReport || findReporteByUsuario(reportes, usuario);
  if (!target) {
    return null;
  }

  const related = getRelatedReportes(reportes, target, 8);

  return {
    objetivo: {
      id: target.id,
      usuario: target.usuario,
      categoria: target.categoria,
      severidad: target.severidad,
      motivo: target.motivo,
      fecha: target.fecha,
    },
    correlaciones: related.map((item) => ({
      id: item.id,
      usuario: item.usuario,
      categoria: item.categoria,
      severidad: item.severidad,
      motivo: item.motivo,
      fecha: item.fecha,
    })),
  };
}

function buildCorrelationPrompt(config, correlationInput, overrides = {}) {
  const sections = [
    config.reportCorrelationPrompt,
    config.reportCorrelationInstructions,
    toSafeText(overrides?.customPrompt, ''),
    toSafeText(overrides?.customInstructions, ''),
    'CORRELACION_JSON:',
    JSON.stringify(correlationInput, null, 2),
  ].filter(Boolean);

  return sections.join('\n\n');
}

export async function executeReportCorrelationUseCase({ config, body, reportes }) {
  const correlationInput = buildCorrelationInput({
    reportes,
    inputReport: body?.report,
    usuario: body?.usuario,
  });

  if (!correlationInput) {
    return {
      ok: false,
      status: 404,
      error: 'No se encontro el usuario objetivo en la base de reportes.',
    };
  }

  const prompt = buildCorrelationPrompt(config, correlationInput, {
    customPrompt: body?.customPrompt,
    customInstructions: body?.customInstructions,
  });

  const upstreamResult = await requestAiGenerate({
    config,
    payload: {
      model: config.model,
      prompt,
      stream: false,
    },
    timeoutMs: 120000,
  });

  if (!upstreamResult.ok) {
    return upstreamResult;
  }

  const rawReply = getAssistantReply(upstreamResult.payload || {});
  const parsed = extractJsonObject(rawReply) || {};
  const parsedCorrelations = Array.isArray(parsed.correlaciones) ? parsed.correlaciones : [];

  return {
    ok: true,
    status: 200,
    payload: {
      target: correlationInput.objetivo,
      correlations: parsedCorrelations,
      globalRisk: parseIntegerOr(parsed.riesgoGlobal, 3),
      conclusion: toSafeText(parsed.conclusion, rawReply.slice(0, 280) || 'Sin conclusion disponible.'),
      raw: rawReply,
    },
  };
}
