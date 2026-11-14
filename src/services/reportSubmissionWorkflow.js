import { buildVideoLinkEvidence, MAX_VIDEO_LINKS, parseVideoLinks } from '../../shared/videoLinks.js';

export async function runReportSubmission({ values, images, apiKey, user, upload, save, onSaved, logger = console }) {
  const report = { ...values, nickname: String(values.nickname || '').trim() };
  delete report.evidence;
  delete report.videoLinks;
  const { links: videoLinks, invalid: invalidVideoLinks } = parseVideoLinks(values.videoLinks);
  if (invalidVideoLinks.length > 0) throw new Error('Revisa los links de video: deben ser URLs HTTP o HTTPS.');
  if (videoLinks.length > MAX_VIDEO_LINKS) throw new Error(`Puedes añadir hasta ${MAX_VIDEO_LINKS} links de video.`);
  const reporter = { id: user?.id || '', name: user?.username || 'Anónimo', email: user?.email || '' };
  
  // Primero validar y subir evidencias (solo si hay)
  // Esto asegura que si falla la subida de evidencias, el reporte NO se crea
  let evidence = [];
  if (Array.isArray(images) && images.length > 0) {
    // Validar que todas las imágenes estén listas
    const evidenceError = images
      .map((img, idx) => (!img || typeof img !== 'object') ? `Evidencia ${idx + 1} invalida` : null)
      .filter(Boolean)[0];
    
    if (evidenceError) {
      throw new Error(evidenceError);
    }
    
    // Intentar subir imágenes a ImgBB
    evidence = await upload(images, apiKey);
    
    // Validar que se subieron todas
    if (!Array.isArray(evidence) || evidence.length !== images.length) {
      throw new Error('No se subieron todas las evidencias. Corrige los archivos o vuelve a intentar antes de crear el reporte.');
    }
    
    // Validar URLs de evidencias
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
  }
  
  // Ahora sí, guardar el reporte con las evidencias verificadas
  evidence = [...evidence, ...buildVideoLinkEvidence(videoLinks)];
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
