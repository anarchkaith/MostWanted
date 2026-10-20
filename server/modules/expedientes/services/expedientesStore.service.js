import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
  fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });
  const filePath = path.join(rootDir, 'data', FILE_NAME);
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, '[]', { encoding: 'utf-8', flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  return filePath;
}

/**
 * Lee todos los expedientes almacenados en disco.
 */
export function readExpedientes(rootDir) {
  const filePath = ensureStorageFile(rootDir);
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!Array.isArray(parsed)) throw new Error('invalid_expedientes_storage');
  return parsed;
}

/**
 * Persiste la lista completa de expedientes en formato JSON.
 */
function writeExpedientes(rootDir, expedientes = []) {
  const filePath = ensureStorageFile(rootDir);
  const stagingPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.staging`;
  let fd;
  try {
    fd = fs.openSync(stagingPath, 'wx');
    fs.writeFileSync(fd, JSON.stringify(expedientes, null, 2), 'utf-8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    const deadline = Date.now() + 1000;
    for (;;) {
      try {
        fs.renameSync(stagingPath, filePath);
        break;
      } catch (error) {
        // Windows scanners/readers can briefly hold the destination open.
        if (!['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || Date.now() >= deadline) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      }
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath);
  }
}

export function updateExpedientes(rootDir, update) {
  fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });
  const lockPath = path.join(rootDir, 'data', 'expedientes.lock');
  const deadline = Date.now() + 2000;
  for (;;) {
    try {
      fs.mkdirSync(lockPath);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  try {
    const items = readExpedientes(rootDir);
    const result = update(items);
    writeExpedientes(rootDir, items);
    return result;
  } finally {
    fs.rmdirSync(lockPath);
  }
}

// Legacy endpoints retain their shape, but never expose internal management data.
export function publicLegacyExpediente(expediente) {
  if (!expediente) return null;
  return {
    expedienteId: expediente.expedienteId, playerKey: expediente.playerKey,
    player: {
      nickname: expediente.player?.nickname, rid: expediente.player?.rid,
      crews: toArray(expediente.player?.crews), aliases: toArray(expediente.player?.aliases),
    },
    createdAt: expediente.createdAt, updatedAt: expediente.updatedAt,
    ...(expediente.status ? { status: expediente.status } : {}),
    votes: {
      legit: expediente.votes?.legit || 0, not_legit: expediente.votes?.not_legit || 0,
      entries: toArray(expediente.votes?.entries).map((entry) => ({
        voteType: entry.voteType, reason: entry.reason, createdAt: entry.createdAt,
      })),
    },
    reports: toArray(expediente.reports).map((report) => ({
      reportId: report.reportId, source: report.source, reason: report.reason,
      typesOfInfraction: report.typesOfInfraction, labels: report.labels,
      evidence: toArray(report.evidence).map((item) => ({
        url: item?.url, name: item?.name, contentType: item?.contentType,
      })),
      createdAt: report.createdAt,
    })),
  };
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
  if (rid) return -1;

  index = expedientes.findIndex((item) => item?.playerKey === keyByName && !item?.player?.rid && keyByName !== 'name:unknown');
  return index;
}

/**
 * Crea o actualiza expediente de jugador adjuntando un nuevo reporte.
 */
export function createOrAppendReport({ rootDir, body = {}, reporter = null }) {
  return updateExpedientes(rootDir, (expedientes) => {
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
      name: toTrimmedString(reporter?.name) || 'anonimo',
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
    const note = {
      id: crypto.randomUUID(), text: report.metadata.notes,
      author: { id: String(reporter?.id || ''), name: String(reporter?.name || 'staff') }, createdAt: now,
    };
    expediente.staffNotes = [...toArray(expediente.staffNotes), note];
    expediente.history = [...toArray(expediente.history), {
      id: crypto.randomUUID(), type: 'note_added', noteId: note.id, author: note.author, createdAt: now,
    }];
  }

  expediente.reports = [report, ...toArray(expediente.reports)].slice(0, 500);
  expediente.updatedAt = now;

  return {
    expediente,
    appendedReport: report,
    created,
  };
  });
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
  return updateExpedientes(rootDir, (expedientes) => {
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
      name: toTrimmedString(voter?.name) || 'anonimo',
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

  return { ok: true, expediente };
  });
}
