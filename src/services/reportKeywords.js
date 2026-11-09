// Reglas por etiqueta: `patterns` (alguna coincide), `requires` (todas deben coincidir) y `unless` (ninguna debe coincidir).
// Se aplican sobre el texto normalizado (minúsculas, sin acentos).
const KEYWORD_RULES = [
  // Glitcher
  { label: 'Abuso de bugs', patterns: [/\babus\w*\s+(de\s+)?(los\s+|un\s+|el\s+)?(bugs?|glitch\w*|fallos?|errores?)\b/, /\bexploit\w*/] },
  { label: 'Duplicación de objetos', patterns: [/\bdup(e|eo|eos|ea|ear|eaba|eado|licar|licacion|licando)\b/, /\bduplic\w*/] },
  { label: 'Inmunidad a daños / Godmode por exploit', patterns: [/\binmune?\b/, /\binmunidad\w*/, /\binmortal\w*/] },
  { label: 'Disparar a través de estructuras', patterns: [/\b(disparo|disparos|bala|balas|disparar|disparaba|disparando|dispare)\b.{0,30}\b(a traves|traves de)\b/, /\bshoot\w* through\b/] },
  { label: 'Velocidad aumentada (speedhack)', patterns: [/\bspeed ?hack\w*/, /\bvelocidad (aumentada|excesiva|anormal|hack\w*)/] },
  { label: 'Salir de mapa / Explorar fuera de límites', patterns: [/\bfuera (del|de) (el )?mapa\b/, /\bfuera de (los )?limites\b/, /\bsal\w* del mapa\b/, /\bout of bounds\b/] },
  { label: 'Invencibilidad temporal (exploit)', patterns: [/\binvencib\w*/, /\binvulnerab\w*/] },
  { label: 'Autocuracion / regeneracion por exploit', patterns: [/\bautocur\w*/, /\bregenera\w*/] },

  // Griffer
  { label: 'Abusar de vehículos/objetos explotables', patterns: [/\babus\w*.{0,25}\b(vehiculos?|objetos|autos?|coches?|camiones?|helicopteros?|aviones?)\b/, /\bkamikaze\b/] },
  { label: 'Spawnkill', patterns: [/\bspawn ?kill\w*/] },
  { label: 'Trolleo masivo (interrupción de partidas)', patterns: [/\btroll\w*/, /\bgrief\w*/, /\binterrump\w*.{0,20}\bpartidas?\b/] },
  { label: 'Sabotaje de partidas', patterns: [/\bsabot\w*/] },
  { label: 'Raideo de servidor / invasión coordinada', patterns: [/\braid\w*/, /\binvasi\w* (coordinad\w*|organizad\w*|masiv\w*)/] },
  { label: 'Ataque DDoS / daño a infraestructura', patterns: [/\bddos\w*/, /\btumb\w* (el )?servidor\b/] },
  { label: 'Spameo de bots / automatización maliciosa', patterns: [/\bbots?\b/, /\bautomatiz\w*/] },

  // Modder
  { label: 'Godmode (hack)', patterns: [/\bgod ?mode\b/, /\bmodo dios\b/] },
  { label: 'Teleport (hack)', patterns: [/\btele ?port\w*/, /\bteletransport\w*/] },
  { label: 'Wallhack / ESP', patterns: [/\bwall ?hack\w*/, /\besp\b/, /\bver a traves de (las )?paredes\b/] },
  { label: 'Aimbot', patterns: [/\baim ?bot\w*/, /\bauto ?aim\w*/, /\bsnap ?aim\w*/] },
  { label: 'Explosiones invisibles / efectos no autorizados', patterns: [/\bexplosion\w* (invisible\w*|fantasma\w*|falsa\w*)/] },
  { label: 'Spawnear objetos (manipulación de economía)', patterns: [/\bspawne\w*/, /\bdinero (infinito|falso|de la nada)\b/] },
  { label: 'Congelar jugadores (modding)', patterns: [/\bcongel\w*/, /\bfreez\w*/] },
  { label: 'Kickear de la sesión (modding)', patterns: [/\bkick\w*/, /\bexpuls\w* (de|a) (la )?(sesion|partida|lobby)/] },
  { label: 'Flood de mensajes / spam técnico', patterns: [/\bflood\w*/, /\bspam\w*/] },
  { label: 'Manipulación de datos del juego (cheats avanzados)', patterns: [/\bcheat\w*/, /\btrainer\b/, /\bmanipul\w* (de )?(los )?(datos|memoria|stats|estadisticas)/] },
  { label: 'Blackscreen', patterns: [/\bblack ?screen\w*/, /\bpantalla negra\b/] },
  { label: 'Crash', patterns: [/\bcrash\w*/] },
  { label: 'Offradar permanente / infinito (hack)', patterns: [/\boff ?radar\w*/, /\bfuera del radar\b/, /\binvisib\w* (en el )?radar\b/] },
  { label: 'Mod menu detectado (evidencia confirmada)', patterns: [/\bmod ?menu\b/, /\bmenu (de )?(mods?|hacks?)\b/], requires: [/\b(confirm\w*|evidencia|pruebas?|video|captura|grabacion|clip)\b/] },
  { label: 'Mod menu sospechoso (sin confirmar)', patterns: [/\bmod ?menu\b/, /\bmenu (de )?(mods?|hacks?)\b/], unless: [/\b(confirm\w*|evidencia|pruebas?|video|captura|grabacion|clip)\b/] },
  { label: 'Triggerbot', patterns: [/\btrigger ?bot\w*/] },
  { label: 'Movimiento hack (fly / noclip)', patterns: [/\bno ?clip\b/, /\bfly\b/, /\bfly ?hack\w*/, /\bvolaba\b/] },

  // Acoso/Hostigamiento
  { label: 'Hostigamiento por chat', patterns: [/\bhostigamiento\b/, /\b(hostig|acos|insult)\w*.{0,40}\b(chat|mensaj\w*|voz|texto|lobby|partida)\b/, /\b(chat|mensaj\w*|voz|texto|lobby|partida)\b.{0,40}\b(hostig|acos|insult)\w*/] },
  { label: 'Mensajes de odio / discriminación', patterns: [/\bmensajes? de odio\b/, /\bodio (hacia|contra|a los|a las)\b/, /\bdiscriminat\w*/, /\brac(ista|ismo)\w*/, /\bhomofob\w*/, /\bsexist\w*/, /\bxenofob\w*/] },
  { label: 'Acoso en redes sociales', patterns: [/\b(redes|twitter|tiktok|instagram|youtube|facebook|reddit)\b.{0,40}\b(acos\w*|hostig\w*|insult\w*|amenaz\w*)/, /\b(acos\w*|hostig\w*|insult\w*|amenaz\w*)\b.{0,40}\b(redes|twitter|tiktok|instagram|youtube|facebook|reddit)\b/] },
  { label: 'Acoso grupal / doxxing parcial', patterns: [/\bacoso grupal\b/, /\bacos\w*.{0,30}\b(en grupo|varios|todos|grupal|equipo|crew)\b/] },
  { label: 'Amenazas fuera del juego', patterns: [/\bamenaz\w*/, /\bte (voy|vamos) a (matar|golpear|buscar|encontrar|pegar)\b/] },
  { label: 'Extorsión / suplantación con fines de daño', patterns: [/\bextorsi\w*/, /\bchantaj\w*/, /\bsuplant\w*/] },
  { label: 'Divulgación de información privada (doxxing)', patterns: [/\bdox\w*/, /\bdivulg\w* (su |sus |los |la )?(datos|informacion|direccion|telefono|ip|correo|nombre real)/, /\bdireccion (real|de (su|el|ella))\b/, /\bnumero de (telefono|celular)\b/] },
  { label: 'Phishing / ingeniería social', patterns: [/\bphish\w*/, /\bingenieria social\b/, /\b(link|enlace|pagina|web|sitio) (falso|falsa|sospechos\w*|malicios\w*)\b/, /\bcontrasen\w*.{0,30}\b(pid\w*|rob\w*|dio|dame)\b/] },
  { label: 'Difamación grave', patterns: [/\bdifam\w*/, /\bcalumni\w*/] },
  { label: 'Multicuentas / evasión de sanciones', patterns: [/\bmulti ?cuent\w*/, /\bmulti ?account\w*/, /\bcuentas? (nueva|nuevas|secundaria|alternativa|alt)\w*/, /\bevad\w* (el |su |un |la )?ban\w*/, /\bsegunda cuenta\b/, /\balts?\b/] },
];

export function normalizeKeywordText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Devuelve las categorías y etiquetas del catálogo que el texto sugiere. Sin IA, sin límite de cantidad.
export function suggestInfractionsFromText(text, catalog, rules = KEYWORD_RULES) {
  const normalized = normalizeKeywordText(text);
  if (normalized.length < 10) return { categories: [], labels: [] };

  const categoryByLabel = new Map(catalog.flatMap(type => type.etiquetas.map(item => [item.nombre, type.key])));
  const labels = rules
    .filter(rule => categoryByLabel.has(rule.label))
    .filter(rule => rule.patterns.some(pattern => pattern.test(normalized)))
    .filter(rule => (rule.requires || []).every(pattern => pattern.test(normalized)))
    .filter(rule => !(rule.unless || []).some(pattern => pattern.test(normalized)))
    .map(rule => rule.label);
  const categories = catalog.map(type => type.key)
    .filter(key => labels.some(label => categoryByLabel.get(label) === key));
  return { categories, labels };
}

// Une las sugerencias al selector sin tocar lo que el usuario ya marcó. `previous` son las sugerencias aplicadas antes,
// que se retiran primero para que una nueva lectura del motivo reemplace a la anterior.
export function applyInfractionSuggestion({ text, catalog, typesOfInfraction = [], labels = [], previous = null }) {
  const baseCategories = typesOfInfraction.filter(key => !(previous?.categories || []).includes(key));
  const baseLabels = labels.filter(label => !(previous?.labels || []).includes(label));
  const suggested = suggestInfractionsFromText(text, catalog);
  const applied = {
    categories: suggested.categories.filter(key => !baseCategories.includes(key)),
    labels: suggested.labels.filter(label => !baseLabels.includes(label)),
  };
  return {
    typesOfInfraction: [...baseCategories, ...applied.categories],
    labels: [...baseLabels, ...applied.labels],
    applied,
  };
}

export function removeInfractionSuggestion({ typesOfInfraction = [], labels = [], applied = null }) {
  return {
    typesOfInfraction: typesOfInfraction.filter(key => !(applied?.categories || []).includes(key)),
    labels: labels.filter(label => !(applied?.labels || []).includes(label)),
  };
}

export { KEYWORD_RULES };
