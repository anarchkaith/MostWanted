import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { registerReportsRoutes } from '../http/reports.routes.js';
import { registerExpedientesRoutes } from '../../expedientes/http/expedientes.routes.js';
import { registerCasesRoutes } from '../../expedientes/http/cases.routes.js';
import { accessReportData } from './reportReads.service.js';
import { createCaseReportsSource } from '../../expedientes/services/caseReports.service.js';

const config = { enabled: true, baseUrl: 'https://wordpress.test', apiSecret: 'test-secret', timeoutMs: 1000 };
const logger = { error() {}, info() {} };

test('all report read surfaces deny anonymous callers before accessing data, even with client-supplied identity', async () => {
  const app = express();
  app.use(express.json());
  const deps = { wordpressReportsConfig: config, rateLimits: {
    general: (_req, _res, next) => next(), webhook: (_req, _res, next) => next(),
  }, maybeRequireSessionAuth: (_req, _res, next) => next(),
  requireNonEmptyBody: (_req, _res, next) => next(), requireBodyObject: (_req, _res, next) => next() };
  registerReportsRoutes(app, deps);
  registerCasesRoutes(app, deps);
  registerExpedientesRoutes(app, deps);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/api/reports/search?q=Player', '/api/reports/7', '/api/reports/mine',
      '/api/reports/7/edit', '/api/reports/player-insights?username=Player',
      '/api/players/investigate?username=Player',
      '/api/expedientes/search?q=Player', '/api/expedientes/exp-test']) {
      const response = await fetch(base + path, { headers: { Authorization: 'Bearer test-secret', 'X-User-Id': '123' } });
      assert.equal(response.status, 401, path);
      assert.equal(response.headers.get('cache-control'), 'private, no-store', path);
      assert.equal((await response.json()).code, 'auth_required', path);
    }
    const vote = await fetch(base + '/api/reports/7/community-verification', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"voteType":"up","voterId":"123"}',
    });
    assert.equal(vote.status, 401);
    const submission = await fetch(base + '/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"report":{"nickname":"Player"}}',
    });
    assert.equal(submission.status, 401, 'Submission responses must not provide an anonymous route into player histories');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('scoped backend requests use the existing WordPress secret and verified voter identity only', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith('https://sc-cache.com/')) return Response.json([{ name: 'Old Name', time: 1700000000 }]);
    calls.push({ url: new URL(url), options });
    assert.equal(options.headers.Authorization, 'Bearer test-secret');
    if (String(url).includes('community-verification')) {
      assert.equal(JSON.parse(options.body).voterId, '123');
      return Response.json({ ok: true, communityVerification: { up: 2, down: 0, votesByVoter: { SECRET: true }, confirmations: [{ reason: 'Reason', voterId: 'SECRET' }] } });
    }
    if (String(url).includes('player-insights')) return Response.json({ ok: true, player: { rid: '123', names: [] } });
    return Response.json({ ok: true, report: { id: 7, nickname: 'Player', rid: '123', reporter: { name: 'SECRET' } } });
  };
  try {
    const report = await accessReportData({ config, reportId: '7', logger });
    assert.equal(report.status, 200);
    assert.equal(report.payload.report.id, 7);
    assert.doesNotMatch(JSON.stringify(report), /SECRET|test-secret/);
    assert.equal(calls[0].url.pathname, '/wp-json/mostwanted/v1/reports/7');
    const insights = await accessReportData({ config, username: 'Player', rid: '123', logger });
    assert.equal(insights.status, 200);
    assert.equal(calls[1].url.searchParams.get('rid'), '123');
    assert.deepEqual(insights.payload.player.names, [{ name: 'Old Name', time: 1700000000 }]);
    assert.equal(insights.payload.player.avatars.length, 2);
    const vote = await accessReportData({ config, reportId: '7', user: { id: '123' },
      vote: { voteType: 'up', reason: '', voterName: 'Player', voterId: 'FORGED' }, logger });
    assert.equal(vote.status, 200);
    assert.doesNotMatch(JSON.stringify(vote), /SECRET|FORGED/);
    for (const input of [{ reportId: '../reports' }, { username: [] }, { username: '' },
      { reportId: 7, vote: { voteType: 'down', reason: 'short', voterName: 'x' } }]) {
      assert.equal((await accessReportData({ config, logger, ...input })).status, 400);
    }
    assert.equal(calls.length, 3, 'Invalid requests must not reach WordPress');
    globalThis.fetch = async () => Response.json({ code: 'rest_no_route' }, { status: 404 });
    assert.equal((await accessReportData({ config, reportId: 7, logger })).status, 502);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await accessReportData({ config, reportId: 7, logger })).status, 502);
  } finally { globalThis.fetch = originalFetch; }
});

test('case source refuses an unscoped archive read or missing existing secret', async () => {
  const source = createCaseReportsSource({ config, fetchImpl: () => assert.fail('Unexpected bulk request') });
  await assert.rejects(source({}), /player_identity_required/);
  await assert.rejects(createCaseReportsSource({ config: { ...config, apiSecret: '' } })({ rid: '123' }), /not_configured/);
});
