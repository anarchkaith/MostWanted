// Solo para reconocer URLs legacy de Social Club en reportes aún no migrados; el cliente nunca las construye.
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
