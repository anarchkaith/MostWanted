import assert from 'node:assert/strict';
import test from 'node:test';
import { loadReportArchive, prepareReportArchive, readUserVotes } from './reportArchive.js';

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('archive follows pagination, maps WordPress reports and stores only presentation data', async () => {
  const storage = memoryStorage();
  const calls = [];
  const result = await loadReportArchive({
    storage,
    fetchPage: async options => {
      calls.push(options);
      return { items: options.page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ id: index + 1, nickname: 'Player', ownerDiscordId: 'PRIVATE' }))
        : [{ id: 101, nickname: 'LastPlayer' }] };
    },
  });
  assert.deepEqual(calls.map(call => [call.perPage, call.page]), [[100, 1], [100, 2]]);
  assert.equal(result.reports.length, 101);
  assert.equal(result.reports[100].usuario, 'LastPlayer');
  assert.equal(result.warning, '');
  assert.equal(storage.getItem('mostwanted_reportes').includes('PRIVATE'), false);
});

test('remote failures use the cache with a visible stale warning, never an unmarked empty success', async () => {
  const messages = [];
  const cached = [{ id: 42, usuario: 'CachedPlayer' }];
  const storage = memoryStorage({ mostwanted_reportes: JSON.stringify(cached) });
  for (const fetchPage of [
    async () => { throw new Error('offline'); },
    async () => ({ unexpected: 'shape' }),
  ]) {
    const result = await loadReportArchive({ fetchPage, storage, logger: { error: (...args) => messages.push(args) } });
    assert.deepEqual(result.reports, cached);
    assert.match(result.warning, /desactualizadas/);
  }
  assert.equal(messages.length, 2);
  const result = await loadReportArchive({
    fetchPage: async () => { throw new Error('offline'); }, storage: memoryStorage(), logger: { error() {} },
  });
  assert.deepEqual(result.reports, []);
  assert.match(result.warning, /No se pudo actualizar/);
});

test('corrupt caches fail explicitly and storage failures do not discard a valid remote result', async () => {
  const logger = { error() {} };
  for (const cached of ['invalid-json', '{}']) {
    await assert.rejects(loadReportArchive({
      fetchPage: async () => { throw new Error('offline'); },
      storage: memoryStorage({ mostwanted_reportes: cached }), logger,
    }), /ni leer su copia local/);
  }
  const result = await loadReportArchive({
    fetchPage: async () => ({ items: [{ id: 1, nickname: 'Remote' }] }),
    storage: { setItem() { throw new Error('quota'); } }, logger,
  });
  assert.equal(result.reports[0].usuario, 'Remote');
  assert.match(result.warning, /no se pudo guardar su copia local/);
});

test('cancelled archive requests never overwrite storage or fall back to stale reports', async () => {
  const controller = new AbortController();
  const storage = { setItem() { assert.fail('Cancelled request wrote to storage'); }, getItem() { assert.fail('Cancelled request read fallback'); } };
  await assert.rejects(loadReportArchive({
    signal: controller.signal, storage,
    fetchPage: async () => {
      controller.abort();
      return { items: [{ id: 1 }] };
    },
  }), { name: 'AbortError' });
});

test('archive preparation preserves numbering and merges local vote preferences without mutation', () => {
  const reports = [{ id: 2, fecha: '2026-10-02', userVote: 'up' }, { id: 1, fecha: '2026-10-01' }];
  const before = structuredClone(reports);
  const prepared = prepareReportArchive(reports, { 1: 'down' });
  assert.deepEqual(prepared.map(report => [report.id, report.expedienteId, report.userVote]), [[2, 2, 'up'], [1, 1, 'down']]);
  assert.deepEqual(reports, before);
  assert.deepEqual(readUserVotes(memoryStorage({ mostwanted_user_votes: '{"1":"up"}' })), { 1: 'up' });
  let errors = 0;
  assert.deepEqual(readUserVotes(memoryStorage({ mostwanted_user_votes: '[]' }), { error() { errors += 1; } }), {});
  assert.equal(errors, 1);
});
