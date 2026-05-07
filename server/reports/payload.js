function hasReporterIdentity(reporter = {}) {
  return Boolean(reporter?.id || reporter?.tag || reporter?.email);
}

function hasOwnKeys(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function pickAnalysis(input = {}) {
  const analysis = input?.report?.analysis;

  if (!hasOwnKeys(analysis)) {
    return null;
  }

  return analysis;
}

export function buildHexbotReportPayload(input = {}) {
  const reporter = input?.reporter || {};
  const anonymous = Boolean(input?.anonymous ?? !hasReporterIdentity(reporter));
  const reporterName = reporter.name || (anonymous ? 'Anonimo' : 'Formulario web');
  const analysis = pickAnalysis(input);
  const nickname = input?.report?.nickname || '';

  const reportMetadata = {
    ...(Array.isArray(input?.report?.typesOfInfraction) && input.report.typesOfInfraction.length > 0
      ? { categories: input.report.typesOfInfraction }
      : {}),
    ...(Array.isArray(input?.report?.labels) && input.report.labels.length > 0
      ? { tags: input.report.labels }
      : {}),
    ...(input?.report?.reportedby ? { reportedby: input.report.reportedby } : {}),
    ...(input?.report?.severity ? { severity: input.report.severity } : {}),
    ...(analysis ? { analysis } : {}),
  };

  return {
    username: nickname,
    // Información del jugador reportado
    nickname,
    crews: input?.report?.crews || '',
    avatar1: input?.report?.avatar1 || '',
    avatar2: input?.report?.avatar2 || '',
    rid: input?.report?.rid || null,
    ip: input?.report?.ip || '',
    aliases: input?.report?.aliases || '',
    time: input?.report?.time || null,
    // Información del reporte
    reason: input?.report?.reason || '',
    typesOfInfraction: Array.isArray(input?.report?.typesOfInfraction) ? input.report.typesOfInfraction : [],
    labels: Array.isArray(input?.report?.labels) ? input.report.labels : [],
    reportedby: input?.report?.reportedby || '',
    // Información de la fuente y reporter
    anonymous,
    source: input?.source || 'mostwanted-web',
    reporter: {
      id: reporter.id || (anonymous ? 'anonymous-web' : 'mostwanted-web'),
      name: reporterName,
      ...(reporter.tag ? { tag: reporter.tag } : {}),
    },
    // Evidencias
    evidence: Array.isArray(input?.evidence)
      ? input.evidence.map((item) => ({
        url: item.url,
        name: item.name || 'evidence',
        contentType: item.contentType,
      }))
      : [],
    ...(hasOwnKeys(reportMetadata) ? { report: reportMetadata } : {}),
  };
}
