import crypto from 'node:crypto';
import { INTEL_POLICY_VERSION, sanitizeIntelDigest, toIntelDigest } from '../../intel/services/playerIntel.service.js';
import { readExpedientes, updateExpedientes } from './expedientesStore.service.js';

const INTEL_REFRESH_MS = 6 * 60 * 60 * 1000;
const INTEL_RETRY_MS = 15 * 60 * 1000;
const INTEL_LEASE_MS = 2 * 60 * 1000;

function refreshState(snapshot, now) {
  if (Date.parse(snapshot?.pendingUntil) > now) return 'pending';
  const refreshMs = snapshot?.complete === false ? INTEL_RETRY_MS : INTEL_REFRESH_MS;
  return now - (Date.parse(snapshot?.fetchedAt) || 0) < refreshMs
    || now - (Date.parse(snapshot?.attemptedAt) || 0) < INTEL_RETRY_MS ? 'fresh' : 'due';
}

function preservesAvailableIntel(previous, next) {
  if (previous.nombreActual && !next.nombreActual) return false;
  if (previous.crewSocialClub && !next.crewSocialClub) return false;
  const names = new Set(next.historialNombres.map(entry => JSON.stringify([entry.nombre, entry.desde])));
  if (!previous.historialNombres.every(entry => names.has(JSON.stringify([entry.nombre, entry.desde])))) return false;
  const careers = new Map(next.carreras.map(entry => [entry.plataforma, entry]));
  return previous.carreras.every(entry => {
    const updated = careers.get(entry.plataforma);
    return updated && Object.entries(entry).every(([key, value]) => value == null || updated[key] != null);
  });
}

/**
 * Guarda en el expediente una instantánea de la inteligencia del jugador para el resumen de HEX.
 * Una respuesta parcial solo sustituye otra parcial si conserva sus datos.
 */
export async function refreshCaseIntel({ rootDir, id, getPlayerIntel, logger = console, now = Date.now }) {
  const stored = readExpedientes(rootDir).find(entry => entry.expedienteId === id);
  if (stored?.intelSnapshot?.digest && stored.intelSnapshot.policyVersion !== INTEL_POLICY_VERSION) {
    updateExpedientes(rootDir, items => {
      const item = items.find(entry => entry.expedienteId === id);
      if (!item?.intelSnapshot?.digest || item.intelSnapshot.policyVersion === INTEL_POLICY_VERSION) return item;
      const digest = sanitizeIntelDigest(item.intelSnapshot.digest);
      item.intelSnapshot = {
        ...item.intelSnapshot, digest, policyVersion: INTEL_POLICY_VERSION,
        signature: crypto.createHash('sha256').update(JSON.stringify(digest)).digest('hex').slice(0, 16),
        fetchedAt: null, attemptedAt: null,
      };
      return item;
    });
  }
  if (!getPlayerIntel) return { pending: false };
  const started = now();
  const attemptedAt = new Date(started).toISOString();
  const existing = readExpedientes(rootDir).find(entry => entry.expedienteId === id);
  if (!existing) return { pending: false };
  const initialState = refreshState(existing.intelSnapshot, started);
  if (initialState !== 'due') return { pending: initialState === 'pending' };
  let job = null;
  updateExpedientes(rootDir, (items) => {
    const item = items.find(entry => entry.expedienteId === id);
    if (!item) return item;
    const snapshot = item.intelSnapshot || {};
    const state = refreshState(snapshot, started);
    if (state === 'pending') {
      job = { pending: true };
      return item;
    }
    if (state !== 'due') return item;
    const token = crypto.randomUUID();
    item.intelSnapshot = {
      ...snapshot, attemptedAt, token,
      pendingUntil: new Date(started + INTEL_LEASE_MS).toISOString(),
    };
    job = {
      token, snapshot,
      player: { nickname: item.player?.nickname || '', rid: item.player?.rid ? String(item.player.rid) : '' },
    };
    return item;
  });
  if (!job) return { pending: false };
  if (job.pending) return job;

  let next = null;
  try {
    const result = await getPlayerIntel(job.player);
    if (result.status === 200 && result.payload.found === false && !job.snapshot.digest) {
      next = { signature: null, digest: null, complete: true };
    } else if (result.status === 200 && result.payload.found) {
      const digest = toIntelDigest(result.payload);
      if (result.payload.complete || !job.snapshot.digest
        || (job.snapshot.complete === false && preservesAvailableIntel(job.snapshot.digest, digest))) {
        next = { signature: result.payload.signature, digest, complete: result.payload.complete };
      }
    } else if (result.status !== 200) {
      logger.error('[cases] No se pudo actualizar la inteligencia del jugador:', result.payload?.error || result.status);
    }
  } catch (error) {
    logger.error('[cases] No se pudo actualizar la inteligencia del jugador:', error);
  }

  let owned = false;
  updateExpedientes(rootDir, (items) => {
    const current = items.find(entry => entry.expedienteId === id);
    if (!current || current.intelSnapshot?.token !== job.token) return current;
    owned = true;
    current.intelSnapshot = next
      ? { ...next, policyVersion: INTEL_POLICY_VERSION, fetchedAt: attemptedAt, attemptedAt, token: null, pendingUntil: null }
      : { ...current.intelSnapshot, complete: current.intelSnapshot.complete ?? Boolean(current.intelSnapshot.digest), token: null, pendingUntil: null };
    return current;
  });
  return { pending: !owned };
}
