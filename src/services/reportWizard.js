export const REPORT_WIZARD_STEPS = [
  {
    id: 'identity',
    label: 'Jugador',
    title: 'Identifica al jugador',
    description: 'Comprueba que sea la persona correcta. Los datos adicionales son opcionales.',
    fields: ['nickname', 'investigation_status', 'rid', 'crews', 'aliases', 'avatar1', 'avatar2', 'ip', 'time'],
  },
  {
    id: 'infraction',
    label: 'Infracción',
    title: '¿Qué ocurrió?',
    description: 'Elige al menos una categoría y, si quieres, añade las conductas observadas.',
    fields: ['typesOfInfraction', 'labels'],
  },
  {
    id: 'evidence',
    label: 'Pruebas',
    title: 'Cuenta lo que viste',
    description: 'Describe el incidente y adjunta imágenes si tienes pruebas.',
    fields: ['reason', 'evidence'],
  },
  {
    id: 'review',
    label: 'Revisar',
    title: 'Revisa antes de enviar',
    description: 'Comprueba los datos y vuelve atrás si necesitas corregir algo.',
    fields: [],
  },
];

const assignedFields = new Set(REPORT_WIZARD_STEPS.flatMap(step => step.fields));

function errorMessages(value) {
  if (typeof value === 'string') return value ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(errorMessages);
  if (value && typeof value === 'object') return Object.values(value).flatMap(errorMessages);
  return [];
}

export function reportStepIssues(errors, stepIndex) {
  const step = REPORT_WIZARD_STEPS[stepIndex];
  if (!step) throw new RangeError('Paso del reporte desconocido.');
  const extraFields = stepIndex === 0 ? Object.keys(errors).filter(field => !assignedFields.has(field)) : [];
  return [...step.fields, ...extraFields].flatMap(field => {
    if (!errors[field]) return [];
    const messages = errorMessages(errors[field]);
    return [{ field, messages: messages.length ? messages : [`Revisa el campo ${field}.`] }];
  });
}

export function firstInvalidReportStep(errors) {
  return REPORT_WIZARD_STEPS.findIndex((_, index) => reportStepIssues(errors, index).length > 0);
}
