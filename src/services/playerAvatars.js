export function getPlayerAvatarUrl(rid, index = 0, version = '') {
  if (!rid) throw new Error('RID invalido para obtener avatar');
  const url = `https://prod.cloud.rockstargames.com/members/sc/6266/${encodeURIComponent(String(rid))}/publish/gta5/mpchars/${index}.png`;
  return version ? `${url}?v=${encodeURIComponent(String(version))}` : url;
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
