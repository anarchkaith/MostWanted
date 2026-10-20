export function resolvePlayerRid(player = {}) {
  for (const value of [player.rid, player.wpRid, player.playerRid, player.player_rid]) {
    const rid = String(value ?? '').trim();
    if (/^\d+$/.test(rid) && /[1-9]/.test(rid)) return rid.replace(/^0+/, '');
  }
  const match = /^RID-(\d+)$/.exec(String(player.playerId ?? '').trim());
  return match && /[1-9]/.test(match[1]) ? match[1].replace(/^0+/, '') : '';
}
