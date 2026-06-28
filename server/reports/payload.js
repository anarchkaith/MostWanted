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
  const reporterName = reporter.name || 'Anónimo';
  const analysis = pickAnalysis(input);
  const nickname = input?.report?.nickname || '';
  const aliases = Array.isArray(input?.report?.aliases)
    ? input.report.aliases.filter((item) => typeof item === 'string' && item.trim() !== '')
    : [];
  const crews = Array.isArray(input?.report?.crews)
    ? input.report.crews
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const name = typeof entry.name === 'string' ? entry.name.trim() : '';
        if (!name) return null;
        const url = typeof entry.url === 'string' ? entry.url.trim() : '';
        return { name, url };
      })
      .filter(Boolean)
    : [];

  const reportMetadata = {
    ...(Array.isArray(input?.report?.typesOfInfraction) && input.report.typesOfInfraction.length > 0
      ? { categories: input.report.typesOfInfraction }
      : {}),
    ...(Array.isArray(input?.report?.labels) && input.report.labels.length > 0
      ? { tags: input.report.labels }
      : {}),
    ...(Array.isArray(input?.report?.labelIds) && input.report.labelIds.length > 0
      ? { tagIds: input.report.labelIds }
      : {}),
    ...(input?.report?.reportedby ? { reportedby: input.report.reportedby } : {}),
    ...(input?.report?.investigation_status ? { investigation_status: input.report.investigation_status } : {}),
    ...(analysis ? { analysis } : {}),
  };

  return {
    username: nickname,
    // Información del jugador reportado
    nickname,
    playerId: input?.report?.playerId || '',
    crewCurrent: input?.report?.crewCurrent || '',
    crew1: input?.report?.crew1 || '',
    crew2: input?.report?.crew2 || '',
    crew3: input?.report?.crew3 || '',
    crew4: input?.report?.crew4 || '',
    ...(input?.report?.crewCurrentData && typeof input.report.crewCurrentData === 'object'
      ? { crewCurrentData: input.report.crewCurrentData }
      : {}),
    ...(crews.length > 0 ? { crews } : {}),
    avatar1: input?.report?.avatar1 || '',
    avatar2: input?.report?.avatar2 || '',
    rid: input?.report?.rid || null,
    ip: input?.report?.ip || '',
    aliases,
    time: input?.report?.time || null,
    // Información del reporte
    reason: input?.report?.reason || '',
    typesOfInfraction: Array.isArray(input?.report?.typesOfInfraction) ? input.report.typesOfInfraction : [],
    labels: Array.isArray(input?.report?.labels) ? input.report.labels : [],
    ...(Array.isArray(input?.report?.labelIds) && input.report.labelIds.length > 0
      ? { labelIds: input.report.labelIds }
      : {}),
    reportedby: input?.report?.reportedby || '',
    // Información de la fuente y reporter
    source: input?.source || 'mostwanted-web',
    reporter: {
      id: reporter.id || 'mostwanted-web',
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
