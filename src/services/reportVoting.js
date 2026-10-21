import { normalizeComentariosFromCommunityVerification } from './reportViewModel.js';
import { readUserVotes } from './reportArchive.js';

export function prepareReportVote({ reportId, voteType, reason = '', voterName = '' }, user) {
  if (!Number.isSafeInteger(Number(reportId)) || Number(reportId) <= 0) throw new Error('El reporte no tiene un ID válido para registrar el voto.');
  if (!['up', 'down'].includes(voteType)) throw new Error('El tipo de voto es invalido.');
  const trimmedReason = String(reason).trim();
  const trimmedName = String(voterName).trim();
  if (voteType === 'down' && trimmedReason.length < 8) throw new Error('Debes explicar por qué el reporte es falso (minimo 8 caracteres).');
  if (voteType === 'down' && trimmedName.length < 2) throw new Error('Debes indicar el nombre de quien confirma el reporte falso.');
  const sessionName = user?.username
    ? `${user.username}${user.discriminator && user.discriminator !== '0' ? `#${user.discriminator}` : ''}`
    : 'Comunidad';
  return { reportId: Number(reportId), voteType, reason: trimmedReason, voterName: trimmedName || sessionName };
}

export async function registerReportVote({ request, storage, input, user, logger = console }) {
  const vote = prepareReportVote(input, user);
  const response = await request(vote);
  const verification = response?.communityVerification;
  if (response?.ok !== true || !verification
    || !Number.isSafeInteger(verification.up) || verification.up < 0
    || !Number.isSafeInteger(verification.down) || verification.down < 0) {
    throw new Error('El servidor no confirmó el voto con contadores válidos. Actualiza el reporte antes de reintentar.');
  }
  const result = {
    userVote: vote.voteType,
    votos: {
      up: verification.up, down: verification.down,
      comentarios: normalizeComentariosFromCommunityVerification(verification),
    },
  };
  let warning = '';
  try {
    const votes = readUserVotes(storage, logger);
    storage.setItem('mostwanted_user_votes', JSON.stringify({ ...votes, [vote.reportId]: vote.voteType }));
    const cached = JSON.parse(storage.getItem('mostwanted_reportes') || '[]');
    if (!Array.isArray(cached)) throw new Error('invalid_stored_reports');
    storage.setItem('mostwanted_reportes', JSON.stringify(cached.map(report =>
      String(report.id) === String(vote.reportId) ? { ...report, ...result } : report)));
  } catch (error) {
    logger.error('[reports] El voto se guardó, pero no se pudo actualizar su copia local.', error);
    warning = 'El voto se guardó en WordPress, pero no se pudo actualizar su copia local.';
  }
  return { ...result, warning };
}
