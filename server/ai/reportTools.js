const STOP_WORDS = new Set([
  'a', 'al', 'algo', 'ante', 'bajo', 'cada', 'como', 'con', 'contra', 'cual',
  'cuando', 'de', 'del', 'desde', 'donde', 'durante', 'el', 'ella', 'ellas',
  'ellos', 'en', 'entre', 'era', 'es', 'esa', 'esas', 'ese', 'eso', 'esos',
  'esta', 'estaba', 'estan', 'estar', 'este', 'esto', 'estos', 'fue', 'ha',
  'hace', 'hacia', 'han', 'hasta', 'hay', 'la', 'las', 'le', 'les', 'lo',
  'los', 'mas', 'me', 'mi', 'mis', 'muy', 'no', 'o', 'para', 'pero', 'por',
  'que', 'se', 'sin', 'sobre', 'su', 'sus', 'tambien', 'tiene', 'todo',
  'todos', 'tuvo', 'un', 'una', 'unas', 'uno', 'unos', 'y',
]);

function safeText(value, maxLength = 180) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim().slice(0, maxLength)
    : '';
}

function sanitizeReports(reportes) {
  if (!Array.isArray(reportes)) return [];

  return reportes
    .map((report) => ({
      id: safeText(report?.id, 80) || null,
      usuario: safeText(report?.usuario, 100),
      categoria: safeText(report?.categoria, 80) || 'sin_categoria',
      severidad: safeText(report?.severidad, 80) || 'sin_severidad',
      motivo: safeText(report?.motivo),
      fecha: safeText(report?.fecha, 80),
      etiquetas: Array.isArray(report?.etiquetas)
        ? report.etiquetas.slice(0, 8).map((tag) => safeText(tag, 60)).filter(Boolean)
        : [],
    }))
    .filter((report) => report.usuario);
}

function countBy(reports, getKey) {
  const counts = new Map();
  for (const report of reports) {
    const key = getKey(report);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1]));
}

function tokenize(report) {
  const words = `${report.categoria} ${report.severidad} ${report.motivo} ${report.etiquetas.join(' ')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[\p{L}\p{N}]{3,}/gu) || [];
  return new Set(words.filter((word) => !STOP_WORDS.has(word)));
}

function getSimilarityResults(reports) {
  const sample = [...reports]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 80);
  const tokenSets = sample.map(tokenize);
  const pairs = [];

  for (let first = 0; first < sample.length; first += 1) {
    for (let second = first + 1; second < sample.length; second += 1) {
      const left = tokenSets[first];
      const right = tokenSets[second];
      const intersection = [...left].filter((token) => right.has(token)).length;
      const union = left.size + right.size - intersection;
      const score = union ? intersection / union : 0;
      if (score < 0.3) continue;
      pairs.push({
        reportes: [
          { id: sample[first].id, usuario: sample[first].usuario },
          { id: sample[second].id, usuario: sample[second].usuario },
        ],
        coincidencias: [...left].filter((token) => right.has(token)).slice(0, 8),
        similitud: Number(score.toFixed(2)),
      });
    }
  }

  return {
    comparados: sample.length,
    limiteMuestra: 80,
    paresSimilares: pairs.sort((a, b) => b.similitud - a.similitud).slice(0, 10),
  };
}

function getCommonTerms(reports) {
  const counts = new Map();
  for (const report of reports) {
    for (const token of tokenize(report)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([term, reportsWithTerm]) => ({ term, reportsWithTerm }));
}

function buildReadAllResult(reports) {
  const byUser = new Map();
  for (const report of reports) {
    const current = byUser.get(report.usuario) || {
      usuario: report.usuario,
      totalReportes: 0,
      categorias: Object.create(null),
      severidades: Object.create(null),
    };
    current.totalReportes += 1;
    current.categorias[report.categoria] = (current.categorias[report.categoria] || 0) + 1;
    current.severidades[report.severidad] = (current.severidades[report.severidad] || 0) + 1;
    byUser.set(report.usuario, current);
  }

  return {
    herramienta: 'read_all_reports',
    totalReportes: reports.length,
    totalUsuariosUnicos: byUser.size,
    porCategoria: countBy(reports, (report) => report.categoria),
    porSeveridad: countBy(reports, (report) => report.severidad),
    rankingUsuarios: [...byUser.values()]
      .sort((a, b) => b.totalReportes - a.totalReportes || a.usuario.localeCompare(b.usuario))
      .slice(0, 50),
  };
}

function buildDetailResult(reports, params = {}) {
  const user = safeText(params.usuario, 100);
  const reportId = safeText(params.reportId, 80);
  const matches = reports.filter((report) => reportId
    ? report.id === reportId
    : user && report.usuario.toLocaleLowerCase() === user.toLocaleLowerCase());

  return {
    herramienta: 'get_report_detail',
    objetivo: reportId ? { reportId } : { usuario: user || null },
    totalCoincidencias: matches.length,
    reportes: matches.slice(0, 30),
  };
}

function buildSimilarityResult(reports, params = {}) {
  const recentDaysValue = params.recentDays;
  const recentDays = recentDaysValue === null || typeof recentDaysValue === 'undefined' || recentDaysValue === ''
    ? null
    : Math.max(1, Math.min(60, Math.round(Number(recentDaysValue))));
  const analysisReports = recentDays === null || !Number.isFinite(recentDays)
    ? reports
    : reports.filter((report) => {
      const timestamp = Date.parse(report.fecha);
      return Number.isFinite(timestamp) && timestamp >= Date.now() - recentDays * 24 * 60 * 60 * 1000;
    });
  const similar = getSimilarityResults(analysisReports);
  return {
    herramienta: 'analyze_recent_similarity',
    ...(recentDays !== null && Number.isFinite(recentDays) ? { periodoDias: recentDays } : {}),
    totalReportesAnalizados: analysisReports.length,
    totalUsuariosUnicos: new Set(analysisReports.map((report) => report.usuario)).size,
    porCategoria: countBy(analysisReports, (report) => report.categoria),
    porSeveridad: countBy(analysisReports, (report) => report.severidad),
    terminosFrecuentes: getCommonTerms(analysisReports),
    comparacionDePares: similar,
  };
}

export function executeReportTool({ tool, params, reportes }) {
  const reports = sanitizeReports(reportes);

  if (tool === 'read_all_reports') return buildReadAllResult(reports);
  if (tool === 'get_report_detail') return buildDetailResult(reports, params);
  if (tool === 'analyze_recent_similarity') return buildSimilarityResult(reports, params);

  return null;
}
