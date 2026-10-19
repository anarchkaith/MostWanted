const SOCIALCLUB_CREW_PATTERN = /socialclub\.rockstargames\.com\/crew\/([^\s/)\]?#]+)/i;

function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function decodeSegment(value = '') {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Acepta el nombre de una crew o un link de Social Club (incluso en formato markdown)
 * y devuelve el nombre limpio junto con su URL de jerarquia. Devuelve null si no hay nombre valido.
 */
export function buildCrewLink(input = '') {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const match = raw.match(SOCIALCLUB_CREW_PATTERN);
  const name = (match ? decodeSegment(match[1]) : raw).trim();
  const slug = slugify(name);
  if (!slug) return null;

  return {
    name,
    url: `https://socialclub.rockstargames.com/crew/${slug}/hierarchy`,
  };
}
