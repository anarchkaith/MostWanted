import * as Yup from 'yup';
import { BLOCKED_REPORTED_USERNAME_MESSAGE, isBlockedReportedUsername } from './blockedUsernames';

export const reportFormValidationSchema = Yup.object({
  // Información del jugador reportado
  nickname: Yup.string()
    .trim()
    .test(
      'blocked-reported-username',
      BLOCKED_REPORTED_USERNAME_MESSAGE,
      (value) => !value || !isBlockedReportedUsername(value),
    )
    .required('El nickname es obligatorio'),

  crews: Yup.string()
    .trim()
    .nullable(),

  avatar1: Yup.string()
    .trim()
    .nullable(),

  avatar2: Yup.string()
    .trim()
    .nullable(),

  rid: Yup.number()
    .typeError('RID debe ser un número')
    .nullable(),

  ip: Yup.string()
    .trim()
    .matches(
      /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
      'IP inválida'
    )
    .nullable(),

  aliases: Yup.string()
    .trim()
    .nullable(),

  time: Yup.number()
    .typeError('Tiempo debe ser un número')
    .nullable(),

  // Información del reporte
  typesOfInfraction: Yup.array()
    .min(1, 'Seleccioná al menos una categoría')
    .required('Las categorías son obligatorias'),

  reason: Yup.string()
    .trim()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .required('El motivo es obligatorio'),

  evidence: Yup.array().default([]),

  labels: Yup.array(),

  reportedby: Yup.string()
    .trim()
    .nullable(),
});
