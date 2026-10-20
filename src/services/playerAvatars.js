export function getPlayerAvatarUrl(rid, index = 0) {
  if (!rid) throw new Error('RID invalido para obtener avatar');
  return `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(String(rid))}/publish/gta5/mpchars/${index}.png`;
}

export function isRockstarPlayerAvatar(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'prod.cloud.rockstargames.com'
      && /^\/members\/sc\/\d+\/\d+\/publish\/gta5\/mpchars\/[01]\.png$/.test(parsed.pathname);
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}
