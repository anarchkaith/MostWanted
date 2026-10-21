function imageUrl(value) {
  if (typeof value !== 'string') return '';
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(value)) return value;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    return '';
  }
}

export function reportEvidence(report) {
  const entries = Array.isArray(report.evidencias) && report.evidencias.length
    ? report.evidencias
    : Array.isArray(report.evidence) && report.evidence.length ? report.evidence
      : report.evidencia ? [report.evidencia] : [];
  return entries.map((entry, index) => {
    const object = entry && typeof entry === 'object' ? entry : {};
    const src = imageUrl(object.preview || object.url || (typeof entry === 'string' ? entry : ''));
    return {
      id: `${object.id || 'evidence'}-${index}`,
      src,
      label: String(object.nombre || object.name || `Evidencia ${index + 1}`),
      type: String(object.tipo || object.contentType || 'image/png'),
    };
  });
}
