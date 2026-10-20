export function getPlayerAvatarUrl(rid, index = 0) {
  if (!rid) throw new Error('RID invalido para obtener avatar');
  return `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(String(rid))}/publish/gta5/mpchars/${index}.png`;
}
