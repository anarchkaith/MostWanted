import * as Yup from 'yup';
import { BLOCKED_REPORTED_USERNAME_MESSAGE, isBlockedReportedUsername } from './blockedUsernames';
import { MAX_VIDEO_LINKS, parseVideoLinks } from '../shared/videoLinks.js';

export const reportFormValidationSchema = Yup.object({
  investigation_status: Yup.string()
    .oneOf(['not_attempted', 'pending', 'resolved', 'not_found'])
    .required(),

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
    .matches(/^https?:\/\/\S+$/i, { message: 'Usa una URL de imagen HTTP o HTTPS', excludeEmptyString: true })
    .nullable(),

  avatar2: Yup.string()
    .trim()
    .matches(/^https?:\/\/\S+$/i, { message: 'Usa una URL de imagen HTTP o HTTPS', excludeEmptyString: true })
    .nullable(),

  rid: Yup.number()
    .transform((value, originalValue) => {
      if (originalValue === '' || originalValue === null || typeof originalValue === 'undefined') {
        return null;
      }
      return value;
    })
    .typeError('RID debe ser un número')
    .nullable()
    .when('investigation_status', {
      is: 'resolved',
      then: (schema) => schema.required('RID obligatorio cuando la investigacion encuentra datos.'),
      otherwise: (schema) => schema,
    }),

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

  videoLinks: Yup.string()
    .nullable()
    .test('video-links-valid', 'Usa links de video HTTP o HTTPS válidos, uno por línea.', value => parseVideoLinks(value).invalid.length === 0)
    .test('video-links-max', `Puedes añadir hasta ${MAX_VIDEO_LINKS} links de video.`, value => parseVideoLinks(value).links.length <= MAX_VIDEO_LINKS),

  labels: Yup.array(),
});
