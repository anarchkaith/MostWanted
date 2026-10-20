export function playerPath(nickname) {
  return `/jugador/${encodeURIComponent(nickname)}`;
}

export function readPlayerRoute(path) {
  const match = path.match(/^\/(jugador|usuario)\/([^/]+)$/);
  if (!match) return { caseId: '', player: null };
  let name;
  try {
    name = decodeURIComponent(match[2]);
  } catch (error) {
    if (!(error instanceof URIError)) throw error;
    return { caseId: '', player: null, error: 'La URL del jugador contiene un nombre inválido.' };
  }
  if (match[1] === 'jugador' && /^case-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(name)) {
    return { caseId: name, player: null };
  }
  return { caseId: '', player: /^\d+$/.test(name) ? { nickname: '', rid: name } : { nickname: name, rid: '' } };
}
