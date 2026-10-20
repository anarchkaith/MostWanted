import { resolvePlayerRid } from '../../shared/playerIdentity.js';

export function reportPlayerDraft(player = {}) {
  const result = player.investigation;
  const rid = resolvePlayerRid(player) || resolvePlayerRid(result || {});
  const nickname = result?.nombre && result.nombre !== `RID ${rid}` ? result.nombre : player.nickname || '';
  return {
    nickname,
    rid,
    investigation_status: player.investigationCompleted ? (rid ? 'resolved' : 'not_found') : 'not_attempted',
    aliases: (result?.profile?.aliases || []).filter(name => name.trim().toLowerCase() !== nickname.trim().toLowerCase()).join(', '),
    crews: (result?.profile?.crews || []).join(', '),
    avatar1: result?.avatares?.[0]?.avatarUrl || '',
    avatar2: result?.avatares?.[1]?.avatarUrl || '',
  };
}

export function completeReportPlayerDraft(values, player) {
  const currentRid = resolvePlayerRid(values);
  const incomingRid = resolvePlayerRid(player) || resolvePlayerRid(player.investigation || {});
  if (currentRid && incomingRid && currentRid !== incomingRid) return values;
  if (!player.rid && String(values.nickname || '').trim().toLowerCase() !== String(player.nickname || '').trim().toLowerCase()) return values;
  const draft = reportPlayerDraft(player);
  return {
    ...values,
    investigation_status: draft.investigation_status,
    nickname: draft.nickname || values.nickname,
    rid: draft.rid || values.rid,
    aliases: draft.aliases,
    ...Object.fromEntries(['crews', 'avatar1', 'avatar2']
      .filter(key => !values[key] && draft[key]).map(key => [key, draft[key]])),
  };
}
