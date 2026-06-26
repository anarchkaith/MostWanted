import fs from 'node:fs';
import path from 'node:path';

const FILE_NAME = 'expedientes.json';

/**
 * Convierte a string con trim; retorna vacio para valores no string.
 */
function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Asegura que el valor sea arreglo para evitar validaciones repetidas.
 */
function toArray(values) {
  return Array.isArray(values) ? values : [];
}

/**
 * Normaliza texto para comparaciones flexibles ignorando mayusculas y tildes.
 */
function normalizeText(value) {
  return toTrimmedString(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normaliza nickname y colapsa espacios para crear claves estables.
 */
function normalizeNickname(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

/**
 * Crea una clave unica de jugador priorizando RID cuando existe.
 */
function buildPlayerKey({ nickname = '', rid = '' } = {}) {
  const normalizedRid = toTrimmedString(rid);
  if (/^\d+$/.test(normalizedRid)) {
    return `rid:${normalizedRid}`;
  }

  const normalizedNickname = normalizeNickname(nickname);
  return normalizedNickname ? `name:${normalizedNickname}` : 'name:unknown';
}

/**
 * Garantiza que el archivo de persistencia local exista antes de leer/escribir.
 */
function ensureStorageFile(rootDir) {
  const filePath = path.join(rootDir, 'data', FILE_NAME);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
  }
  return filePath;
}

/**
 * Lee todos los expedientes almacenados en disco.
 */
export function readExpedientes(rootDir) {
  const filePath = ensureStorageFile(rootDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Persiste la lista completa de expedientes en formato JSON.
 */
function writeExpedientes(rootDir, expedientes = []) {
  const filePath = ensureStorageFile(rootDir);
  fs.writeFileSync(filePath, JSON.stringify(expedientes, null, 2), 'utf-8');
}

/**
 * Limpia, deduplica y limita crews asociadas a un jugador.
 */
function normalizeCrews(values = []) {
  return Array.from(new Set(
    toArray(values)
      .map((item) => toTrimmedString(item))
      .filter(Boolean),
  )).slice(0, 20);
}

/**
 * Limpia, deduplica y limita aliases de jugador.
 */
function normalizeAliases(values = []) {
  return Array.from(new Set(
    toArray(values)
      .map((item) => toTrimmedString(item))
      .filter(Boolean),
  )).slice(0, 50);
}

/**
 * Extrae identidad base del jugador desde payload de investigacion o reporte.
 */
function resolvePlayerIdentity({ player = {}, report = {} } = {}) {
  const nickname =
    toTrimmedString(player?.nickname)
    || toTrimmedString(report?.nickname)
    || toTrimmedString(report?.usuario)
    || 'UNKNOWN_PLAYER';

  const ridRaw =
    toTrimmedString(player?.rid)
    || toTrimmedString(report?.rid)
    || '';

  return {
    nickname,
    rid: /^\d+$/.test(ridRaw) ? ridRaw : '',
    crews: normalizeCrews([
      ...toArray(player?.crews),
      toTrimmedString(player?.crewCurrent),
      toTrimmedString(report?.crewCurrent),
      toTrimmedString(report?.crew1),
      toTrimmedString(report?.crew2),
      toTrimmedString(report?.crew3),
      toTrimmedString(report?.crew4),
    ]),
    aliases: normalizeAliases([
      ...toArray(player?.aliases),
      ...toArray(report?.aliases),
    ]),
  };
}

/**
 * Construye estructura inicial de expediente para un jugador nuevo.
 */
function buildNewExpediente({ nickname, rid, crews, aliases }) {
  const now = new Date().toISOString();
  const playerKey = buildPlayerKey({ nickname, rid });

  return {
    expedienteId: `exp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    playerKey,
    player: {
      nickname,
      rid: rid || null,
      crews,
      aliases,
    },
    notes: [],
    reports: [],
    votes: {
      legit: 0,
      not_legit: 0,
      entries: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Busca un expediente existente por RID o por nickname normalizado.
 */
function findExpedienteIndex(expedientes = [], { nickname, rid }) {
  const keyByRid = buildPlayerKey({ nickname: '', rid });
  const keyByName = buildPlayerKey({ nickname, rid: '' });

  let index = expedientes.findIndex((item) => item?.playerKey === keyByRid && keyByRid !== 'name:unknown');
  if (index >= 0) return index;

  index = expedientes.findIndex((item) => item?.playerKey === keyByName && keyByName !== 'name:unknown');
  return index;
}

/**
 * Crea o actualiza expediente de jugador adjuntando un nuevo reporte.
 */
export function createOrAppendReport({ rootDir, body = {}, reporter = null }) {
  const expedientes = readExpedientes(rootDir);
  const playerIdentity = resolvePlayerIdentity({
    player: body?.player || {},
    report: body?.report || body,
  });

  let index = findExpedienteIndex(expedientes, playerIdentity);
  let created = false;

  if (index < 0) {
    expedientes.push(buildNewExpediente(playerIdentity));
    index = expedientes.length - 1;
    created = true;
  }

  const expediente = expedientes[index];
  const now = new Date().toISOString();

  const report = {
    reportId: `rep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    source: toTrimmedString(body?.source) || 'mostwanted-web',
    reason: toTrimmedString(body?.report?.reason || body?.reason),
    typesOfInfraction: toArray(body?.report?.typesOfInfraction || body?.typesOfInfraction).filter(Boolean),
    labels: toArray(body?.report?.labels || body?.labels).filter(Boolean),
    evidence: toArray(body?.evidence || body?.report?.evidence),
    reporter: {
      id: toTrimmedString(reporter?.id),
      name: toTrimmedString(reporter?.name) || 'anonimo',
      tag: toTrimmedString(reporter?.tag),
    },
    metadata: {
      reportedby: toTrimmedString(body?.report?.reportedby || body?.reportedby),
      notes: toTrimmedString(body?.notes),
    },
    createdAt: now,
  };

  expediente.player.nickname = playerIdentity.nickname || expediente.player.nickname;
  expediente.player.rid = playerIdentity.rid || expediente.player.rid;
  expediente.player.crews = normalizeCrews([...toArray(expediente.player.crews), ...playerIdentity.crews]);
  expediente.player.aliases = normalizeAliases([...toArray(expediente.player.aliases), ...playerIdentity.aliases]);

  if (report.metadata.notes) {
    expediente.notes = Array.from(new Set([...toArray(expediente.notes), report.metadata.notes])).slice(0, 100);
  }

  expediente.reports = [report, ...toArray(expediente.reports)].slice(0, 500);
  expediente.updatedAt = now;

  writeExpedientes(rootDir, expedientes);

  return {
    expediente,
    appendedReport: report,
    created,
  };
}

/**
 * Obtiene un expediente por su identificador unico.
 */
export function getExpedienteById({ rootDir, expedienteId }) {
  const expedientes = readExpedientes(rootDir);
  return expedientes.find((item) => item?.expedienteId === expedienteId) || null;
}

/**
 * Busca un expediente por jugador usando username o RID.
 */
export function findExpedienteByPlayer({ rootDir, username = '', rid = '' }) {
  const expedientes = readExpedientes(rootDir);
  const index = findExpedienteIndex(expedientes, { nickname: username, rid });
  return index >= 0 ? expedientes[index] : null;
}

/**
 * Busca expedientes por query libre sobre nickname, rid o aliases.
 */
export function searchExpedientes({ rootDir, query = '', limit = 20 }) {
  const normalizedQuery = normalizeText(query);
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(100, Number(limit))) : 20;

  const expedientes = readExpedientes(rootDir);
  if (!normalizedQuery) {
    return expedientes.slice(0, safeLimit);
  }

  return expedientes
    .filter((item) => {
      const nickname = normalizeText(item?.player?.nickname || '');
      const rid = normalizeText(item?.player?.rid || '');
      const aliases = toArray(item?.player?.aliases).map((alias) => normalizeText(alias));
      return nickname.includes(normalizedQuery)
        || rid.includes(normalizedQuery)
        || aliases.some((alias) => alias.includes(normalizedQuery));
    })
    .slice(0, safeLimit);
}

/**
 * Registra un voto de legitimidad dentro de un expediente existente.
 */
export function addVoteToExpediente({ rootDir, expedienteId, voteType, reason = '', voter = null }) {
  const expedientes = readExpedientes(rootDir);
  const index = expedientes.findIndex((item) => item?.expedienteId === expedienteId);

  if (index < 0) {
    return { ok: false, error: 'expediente_not_found' };
  }

  const normalizedVote = String(voteType || '').toLowerCase();
  if (normalizedVote !== 'legit' && normalizedVote !== 'not_legit') {
    return { ok: false, error: 'invalid_vote_type' };
  }

  const expediente = expedientes[index];
  const entry = {
    voteType: normalizedVote,
    reason: toTrimmedString(reason),
    voter: {
      id: toTrimmedString(voter?.id),
      name: toTrimmedString(voter?.name) || 'anonimo',
      tag: toTrimmedString(voter?.tag),
    },
    createdAt: new Date().toISOString(),
  };

  expediente.votes.entries = [entry, ...toArray(expediente?.votes?.entries)].slice(0, 1000);
  expediente.votes.legit = normalizedVote === 'legit'
    ? Number(expediente?.votes?.legit || 0) + 1
    : Number(expediente?.votes?.legit || 0);
  expediente.votes.not_legit = normalizedVote === 'not_legit'
    ? Number(expediente?.votes?.not_legit || 0) + 1
    : Number(expediente?.votes?.not_legit || 0);
  expediente.updatedAt = new Date().toISOString();

  writeExpedientes(rootDir, expedientes);

  return { ok: true, expediente };
}
