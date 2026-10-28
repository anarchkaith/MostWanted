export async function runReportSubmission({ values, images, apiKey, user, upload, save, onSaved, logger = console }) {
  const report = { ...values, nickname: String(values.nickname || '').trim() };
  delete report.evidence;
  const reporter = { id: user?.id || '', name: user?.username || 'Anónimo', email: user?.email || '' };
  const evidence = await upload(images, apiKey);
  if (!Array.isArray(evidence) || evidence.length !== images.length) {
    throw new Error('No se subieron todas las evidencias. Corrige los archivos o vuelve a intentar antes de crear el reporte.');
  }
  for (const item of evidence) {
    let url;
    try {
      url = new URL(item?.url);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      throw new Error(`La evidencia ${item?.name || ''} no tiene una URL valida. Vuelve a subirla antes de crear el reporte.`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error(`La evidencia ${item?.name || ''} no tiene una URL HTTP o HTTPS. Vuelve a subirla antes de crear el reporte.`);
    }
  }
  const result = await save({ report, reporter, evidence });
  let warning = result.warning || '';
  try {
    const refresh = await onSaved?.(report, result);
    warning = [warning, refresh?.warning].filter(Boolean).join(' ');
  } catch (error) {
    logger.warn('[MostWanted] No se pudo actualizar la ficha después de guardar el reporte.', error);
    warning = [warning, 'El reporte se guardó, pero no se pudo refrescar la ficha. Vuelve a buscar al jugador para actualizarla.'].filter(Boolean).join(' ');
  }
  return {
    nickname: report.nickname,
    report,
    evidence,
    discordDelivery: result.discordDelivery || null,
    warning,
  };
}
