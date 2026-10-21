import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchOwnedReports } from './ownedReports.js';

const endpoint = 'https://api.example.test/api/reports/mine';
const item = { id: 7, nickname: 'Player', categories: ['MODDER'] };

test('private reports retain session credentials, cancellation and pagination without sending an owner', async () => {
  const controller = new AbortController();
  const result = await fetchOwnedReports({
    endpoint, page: 2, signal: controller.signal,
    request: async (url, options) => {
      assert.equal(url, `${endpoint}?page=2`);
      assert.equal(options.credentials, 'include');
      assert.equal(options.cache, 'no-store');
      assert.equal(options.signal, controller.signal);
      return Response.json({ ok: true, items: [item], hasMore: true });
    },
  });
  assert.deepEqual(result.items, [item]);
});

test('the deployed HTML 404 becomes an explicit deployment diagnostic, never a parsing error or empty success', async () => {
  await assert.rejects(fetchOwnedReports({
    endpoint, request: async () => new Response('<!DOCTYPE html><pre>Cannot GET /api/reports/mine</pre>', { status: 404 }),
  }), error => {
    assert.match(error.message, /HTTP 404.*desplegar.*backend.*\/api\/reports\/mine/);
    assert.doesNotMatch(error.message, /Unexpected token/);
    return true;
  });
});

test('HTML, expired sessions and malformed success payloads never become an empty report list', async () => {
  for (const response of [
    () => new Response('<!DOCTYPE html>', { status: 502 }),
    () => Response.json({ ok: true, items: [] }),
    () => Response.json({ ok: true, items: [null], hasMore: false }),
    () => Response.json({ ok: true, items: [{ ...item, categories: null }], hasMore: false }),
    () => Response.json({ ok: true, items: [{ ...item, id: 0 }], hasMore: false }),
  ]) {
    await assert.rejects(fetchOwnedReports({ endpoint, request: async () => response() }));
  }
  await assert.rejects(fetchOwnedReports({
    endpoint, request: async () => Response.json({ error: 'Debes iniciar sesión con Discord.' }, { status: 401 }),
  }), /Debes iniciar sesión/);
  const cancelled = new DOMException('Cancelled', 'AbortError');
  await assert.rejects(fetchOwnedReports({ endpoint, request: async () => { throw cancelled; } }), error => error === cancelled);
});

test('empty reports remain a valid confirmed result and invalid pages never request', async () => {
  assert.deepEqual(await fetchOwnedReports({
    endpoint, request: async () => Response.json({ ok: true, items: [], hasMore: false }),
  }), { ok: true, items: [], hasMore: false });
  for (const page of [0, -1, 1.5, '1']) {
    await assert.rejects(fetchOwnedReports({ endpoint, page, request: () => assert.fail('Invalid page requested') }), /entero positivo/);
  }
});
