import { resolvePlayerRid } from '../../shared/playerIdentity.js';

export function reportPlayerDraft(player = {}) {
  const result = player.investigation;
  const rid = resolvePlayerRid(player) || resolvePlayerRid(result || {});
  return {
    nickname: result?.nombre && result.nombre !== `RID ${rid}` ? result.nombre : player.nickname || '',
    rid,
    investigation_status: player.investigationCompleted ? (rid ? 'resolved' : 'not_found') : 'not_attempted',
    aliases: (result?.profile?.aliases || []).join(', '),
    crews: (result?.profile?.crews || []).join(', '),
    avatar1: result?.avatares?.[0]?.avatarUrl || '',
    avatar2: result?.avatares?.[1]?.avatarUrl || '',
  };
}

export function completeReportPlayerDraft(values, player) {
  if (!player.rid && String(values.nickname || '').trim().toLowerCase() !== String(player.nickname || '').trim().toLowerCase()) return values;
  const draft = reportPlayerDraft(player);
  return {
    ...values,
    investigation_status: draft.investigation_status,
    rid: draft.rid || values.rid,
    ...Object.fromEntries(['aliases', 'crews', 'avatar1', 'avatar2']
      .filter(key => !values[key] && draft[key]).map(key => [key, draft[key]])),
  };
}
