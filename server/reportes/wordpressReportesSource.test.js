import test from 'node:test';
import assert from 'node:assert/strict';
import { createWordpressReportesSource } from './wordpressReportesSource.js';

const config = { enabled: true, baseUrl: 'https://wp.example', apiSecret: 'secret', timeoutMs: 1000 };

const rawItem = (id) => ({
  id,
  nickname: `Player${id}`,
  rid: String(1000 + id),
  typesOfInfraction: ['Crash'],
  reason: `Motivo ${id}`,
  time: 1761102672,
  labels: [{ label: 'Crash' }, 'Godmode'],
});

test('pagina todos los reportes y los mapea al formato de HEX', async () => {
  const calls = [];
  const fetchPage = async ({ page, perPage }) => {
    calls.push({ page, perPage });
    const items = page === 1 ? Array.from({ length: 100 }, (_, i) => rawItem(i + 1)) : [rawItem(101)];
    return { payload: { ok: true, items, hasMore: page === 1 } };
  };
  const getReportes = createWordpressReportesSource({ config, fetchPage, fallback: () => [] });

  const reportes = await getReportes();

  assert.deepEqual(calls, [{ page: 1, perPage: 100 }, { page: 2, perPage: 100 }]);
  assert.equal(reportes.length, 101);
  assert.deepEqual(reportes[0], {
    id: 1,
    usuario: 'Player1',
    rid: '1001',
    categoria: 'Crash',
    motivo: 'Motivo 1',
    fecha: new Date(1761102672 * 1000).toISOString(),
    etiquetas: ['Crash', 'Godmode'],
  });
});

test('usa el cache dentro del TTL y vuelve a consultar después', async () => {
  let clock = 0;
  let fetches = 0;
  const fetchPage = async () => {
    fetches += 1;
    return { payload: { ok: true, items: [rawItem(1)], hasMore: false } };
  };
  const getReportes = createWordpressReportesSource({
    config, fetchPage, fallback: () => [], cacheTtlMs: 1000, now: () => clock,
  });

  await getReportes();
  await getReportes();
  assert.equal(fetches, 1);

  clock = 2000;
  await getReportes();
  assert.equal(fetches, 2);
});

test('usa el fallback cuando WordPress no está configurado', async () => {
  const getReportes = createWordpressReportesSource({
    config: { enabled: false },
    fetchPage: async () => { throw new Error('no debería llamarse'); },
    fallback: () => [{ usuario: 'local' }],
  });

  assert.deepEqual(await getReportes(), [{ usuario: 'local' }]);
});

test('usa el fallback ante error de WordPress y no cachea el fallo', async () => {
  let fetches = 0;
  const fetchPage = async () => {
    fetches += 1;
    if (fetches === 1) throw new Error('timeout');
    return { payload: { ok: true, items: [rawItem(1)], hasMore: false } };
  };
  const getReportes = createWordpressReportesSource({
    config, fetchPage, fallback: () => [{ usuario: 'local' }], logger: { warn() {} },
  });

  assert.deepEqual(await getReportes(), [{ usuario: 'local' }]);
  const second = await getReportes();
  assert.equal(second.length, 1);
  assert.equal(second[0].usuario, 'Player1');
});
