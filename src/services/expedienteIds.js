function compareReportChronology(left, right) {
  const leftDate = Date.parse(String(left?.fecha || ''));
  const rightDate = Date.parse(String(right?.fecha || ''));
  const normalizedLeftDate = Number.isFinite(leftDate) ? leftDate : Number.NEGATIVE_INFINITY;
  const normalizedRightDate = Number.isFinite(rightDate) ? rightDate : Number.NEGATIVE_INFINITY;

  if (normalizedLeftDate !== normalizedRightDate) {
    return normalizedLeftDate - normalizedRightDate;
  }

  const leftId = Number(left?.id);
  const rightId = Number(right?.id);
  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) {
    return leftId - rightId;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}

export function assignExpedienteIds(reportes = []) {
  const chronologicalOrder = [...reportes].sort(compareReportChronology);
  const expedienteIdByReport = new Map(
    chronologicalOrder.map((reporte, index) => [reporte, index + 1]),
  );

  return reportes.map((reporte) => ({
    ...reporte,
    expedienteId: expedienteIdByReport.get(reporte),
  }));
}
