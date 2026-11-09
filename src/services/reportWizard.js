import { ASSISTANT_NAME } from '../config/assistant.js';

export const REPORT_WIZARD_STEPS = [
  {
    id: 'evidence',
    label: 'Pruebas',
    title: 'Cuenta lo que viste',
    description: 'Explícalo con tus palabras y adjunta capturas si las tienes. Los datos del jugador son opcionales.',
    fields: ['nickname', 'investigation_status', 'rid', 'crews', 'aliases', 'avatar1', 'avatar2', 'ip', 'time', 'reason', 'evidence'],
  },
  {
    id: 'infraction',
    label: 'Infracciones',
    title: '¿Qué infracciones cometió?',
    description: `${ASSISTANT_NAME} marca las infracciones según tu relato. Revisa y ajusta lo que haga falta.`,
    fields: ['typesOfInfraction', 'labels'],
  },
];

export const REPORT_EVIDENCE_STEP = REPORT_WIZARD_STEPS.findIndex(step => step.id === 'evidence');
export const REPORT_INFRACTION_STEP = REPORT_WIZARD_STEPS.findIndex(step => step.id === 'infraction');

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
