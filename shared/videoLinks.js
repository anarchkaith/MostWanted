export const VIDEO_LINK_CONTENT_TYPE = 'text/uri-list';
export const MAX_VIDEO_LINKS = 3;
// Discord limita la URL de un botón de enlace a 512 caracteres.
const MAX_VIDEO_LINK_LENGTH = 512;

function toHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.href.length <= MAX_VIDEO_LINK_LENGTH ? url.href : '';
  } catch {
    return '';
  }
}

/**
 * Separa el texto del formulario (uno o varios links por línea) en links válidos e inválidos.
 */
export function parseVideoLinks(text = '') {
  const tokens = String(text || '').split(/\s+/).map(token => token.trim()).filter(Boolean);
  const links = [];
  const invalid = [];
  for (const token of tokens) {
    const url = toHttpUrl(token);
    if (!url) invalid.push(token);
    else if (!links.includes(url)) links.push(url);
  }
  return { links, invalid };
}

export function isVideoLinkEvidence(item) {
  return String(item?.contentType || '').toLowerCase() === VIDEO_LINK_CONTENT_TYPE;
}

export function isValidVideoLink(value) {
  return Boolean(toHttpUrl(String(value || '').trim()));
}

export function buildVideoLinkEvidence(links = []) {
  return links.map((url, index) => {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return { url, name: `Video ${index + 1} (${host})`, contentType: VIDEO_LINK_CONTENT_TYPE };
  });
}
