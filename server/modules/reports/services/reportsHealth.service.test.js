import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { checkReportsHealth } from './reportsHealth.service.js';
import { registerReportsRoutes } from '../http/reports.routes.js';

const config = {
  enabled: true, baseUrl: 'https://wordpress.test', apiSecret: 'test-only', timeoutMs: 1000,
};
const logger = { info() {}, warn() {}, error() {} };

test('missing or disabled WordPress returns 503 without contacting any service', async t => {
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    throw new Error('Unexpected network call');
  });
  for (const wordpressReportsConfig of [
    { ...config, enabled: false }, { ...config, apiSecret: '' }, { ...config, baseUrl: '' },
  ]) {
    const result = await checkReportsHealth({ wordpressReportsConfig, logger });
    assert.equal(result.status, 503);
    assert.equal(result.payload.ok, false);
    assert.equal(result.payload.configured, false);
    assert.match(result.payload.error, /WordPress/);
  }
  assert.equal(requests, 0);
});

test('healthy WordPress preserves the health response contract', async t => {
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    urls.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(Object.hasOwn(options.headers, 'Authorization'), false);
    return new Response(JSON.stringify({ ok: true, secretConfigured: true }), { status: 200 });
  });
  const result = await checkReportsHealth({ wordpressReportsConfig: config, logger });
  assert.deepEqual(result, {
    status: 200,
    payload: {
      ok: true, configured: true,
      upstream: { status: 200, payload: { ok: true, secretConfigured: true } },
    },
  });
  assert.deepEqual(urls, ['https://wordpress.test/wp-json/mostwanted/v1/health']);
});

test('WordPress failures return 502 without trying an alternative destination', async t => {
  let requests = 0;
  let failure = 'http';
  t.mock.method(globalThis, 'fetch', async () => {
    requests += 1;
    if (failure === 'network') throw new Error('Connection failed');
    if (failure === 'timeout') throw new DOMException('Timed out', 'TimeoutError');
    return new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 });
  });
  for (failure of ['http', 'network', 'timeout']) {
    const result = await checkReportsHealth({ wordpressReportsConfig: config, logger });
    assert.equal(result.status, 502);
    assert.equal(result.payload.ok, false);
    assert.equal(result.payload.configured, true);
    assert.match(result.payload.error, /WordPress/);
    assert.equal(result.payload.upstreamStatus, failure === 'http' ? 503 : 0);
  }
  assert.equal(requests, 3);
});

test('reports health route needs only WordPress dependencies', async () => {
  const app = express();
  registerReportsRoutes(app, {
    wordpressReportsConfig: { ...config, enabled: false },
    rateLimits: { webhook: (_req, _res, next) => next(), general: (_req, _res, next) => next() },
    maybeRequireSessionAuth: (_req, _res, next) => next(),
    requireNonEmptyBody: (_req, _res, next) => next(),
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/reports/health`);
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.configured, false);
    assert.match(payload.error, /WordPress/);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
