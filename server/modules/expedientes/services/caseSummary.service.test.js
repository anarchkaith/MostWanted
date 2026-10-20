import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCase } from './cases.service.js';
import { readExpedientes, updateExpedientes } from './expedientesStore.service.js';
import { createCaseSummaryGenerator, refreshCaseSummary, summaryInput } from './caseSummary.service.js';
import { publicReport } from './caseReports.service.js';
import { submitWordpressReport } from '../../reports/services/submitReport.service.js';

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-summary-'));
let reports = [{
  id: 1, nickname: 'Player', rid: '123', categories: ['MODDER'], reason: 'Denuncia no verificada',
  createdAt: '2026-10-01', reporter: { name: 'PRIVATE_REPORTER' },
  reportedby: 'PRIVATE_REPORTER', ip: 'PRIVATE_IP', notes: 'PRIVATE_NOTE',
}];
let calls = 0;
const generateCaseSummary = async ({ reports: input }) => {
  calls++;
  assert.equal(JSON.stringify(summaryInput(input)).includes('PRIVATE'), false);
  return `Resumen IA de ${input.length} reportes; no implica culpabilidad.`;
};
const query = { rootDir, source: async () => reports, nickname: 'Player', rid: '123', generateCaseSummary };
const logger = { error() {} };
const originalFetch = globalThis.fetch;
try {
  const first = await readCase(query);
  const id = first.payload.case.id;
  assert.equal(calls, 1);
  assert.equal(first.payload.case.classification.stale, false);
  assert.equal(first.payload.case.classification.reportCount, 1);
  assert.match(first.payload.case.classification.text, /Resumen IA/);
  assert.equal(JSON.stringify(first).includes('PRIVATE'), false);
  assert.equal(readExpedientes(rootDir)[0].aiSummary.text, first.payload.case.classification.text);
  await readCase(query);
  assert.equal(calls, 1, 'reloads reuse the persisted summary');
  reports[0].communityVerification = { up: 12, down: 4 };
  await readCase(query);
  assert.equal(calls, 1, 'votes do not rerun AI');
  reports.push({ ...reports[0], id: 2, reason: 'Una nueva denuncia' });
  const updated = await readCase(query);
  assert.equal(calls, 2);
  assert.equal(updated.payload.case.classification.reportCount, 2);
  reports.reverse();
  await readCase(query);
  assert.equal(calls, 2, 'source ordering does not invalidate the summary');
  reports[0].reason = 'Contenido corregido';
  await readCase(query);
  assert.equal(calls, 3, 'content corrections invalidate the summary');

  const stale = await readCase({ ...query, source: async () => { throw new Error('offline'); } });
  assert.equal(calls, 3, 'source outages reuse the summary, never regenerate');
  assert.equal(stale.payload.case.classification.text, readExpedientes(rootDir)[0].aiSummary.text);
  await readCase({ ...query, nickname: 'Empty', rid: '999', source: async () => [] });
  assert.equal(calls, 3, 'no reports means no AI invocation');

  reports.push({ ...reports[0], id: 3 });
  await readCase({ ...query, generateCaseSummary: undefined });
  const previousText = readExpedientes(rootDir)[0].aiSummary.text;
  let failures = 0;
  const fail = async () => { failures++; throw new Error('upstream failed'); };
  const failed = await refreshCaseSummary({ rootDir, id, generate: fail, logger });
  assert.equal(failed.aiSummary.text, previousText, 'failed refresh preserves the last good summary');
  assert.ok(failed.aiSummary.error);
  await refreshCaseSummary({ rootDir, id, generate: fail, logger });
  assert.equal(failures, 1, 'errors have a persisted retry cooldown');
  updateExpedientes(rootDir, (items) => { items[0].aiSummary.retryAfter = '2000-01-01'; });
  await refreshCaseSummary({ rootDir, id, generate: generateCaseSummary });
  assert.equal(calls, 4);

  reports.push({ ...reports[0], id: 4 });
  await readCase({ ...query, generateCaseSummary: undefined });
  let release;
  const pending = refreshCaseSummary({ rootDir, id, generate: async () => {
    calls++;
    await new Promise((resolve) => { release = resolve; });
    return 'Resumen concurrente';
  } });
  await refreshCaseSummary({ rootDir, id, generate: generateCaseSummary });
  assert.equal(calls, 5, 'concurrent requests share a persisted generation lease');
  const pendingRead = await readCase(query);
  assert.equal(pendingRead.payload.case.classification.pending, true);
  release();
  await pending;
  assert.equal(readExpedientes(rootDir)[0].aiSummary.text, 'Resumen concurrente');

  reports.push({ ...reports[0], id: 5 });
  await readCase({ ...query, generateCaseSummary: undefined });
  const superseded = refreshCaseSummary({ rootDir, id, generate: async () => {
    await new Promise((resolve) => { release = resolve; });
    return 'Obsolete summary';
  } });
  reports.push({ ...reports[0], id: 6 });
  await readCase({ ...query, generateCaseSummary: undefined });
  release();
  await superseded;
  assert.notEqual(readExpedientes(rootDir)[0].aiSummary.text, 'Obsolete summary');
  const recovered = await readCase(query);
  assert.equal(recovered.payload.case.classification.reportCount, 6);
  assert.equal(recovered.payload.case.classification.stale, false);
  updateExpedientes(rootDir, (items) => {
    items[0].aiSummary.fingerprint = 'expired';
    items[0].aiSummary.pendingUntil = '2000-01-01';
  });
  await readCase(query);
  assert.equal(calls, 7, 'expired generation leases recover after a process restart');
  const withoutReports = await readCase({ ...query, source: async () => [] });
  assert.equal(withoutReports.payload.case.classification, null, 'removed reports never leave a visible obsolete classification');
  assert.equal(calls, 7);
  assert.deepEqual(publicReport(publicReport(reports[0])), publicReport(reports[0]), 'public serialization is idempotent');
  await assert.rejects(createCaseSummaryGenerator({ config: {} })({ reports }), /not_configured/);

  globalThis.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.stream, false);
    assert.equal(payload.prompt.includes('PRIVATE'), false);
    assert.ok(payload.prompt.includes('Denuncia no verificada'));
    return new Response(JSON.stringify({ response: 'Resumen generado por el proveedor simulado.' }));
  };
  const generate = createCaseSummaryGenerator({ config: {
    useLocalOllama: true, localEndpoint: 'http://ai.test/generate', model: 'fixture',
  } });
  assert.equal(await generate({ reports }), 'Resumen generado por el proveedor simulado.');
  globalThis.fetch = async () => new Response(JSON.stringify({ response: ' ' }));
  await assert.rejects(generate({ reports }), /invalid_response/);

  let refreshed = 0;
  globalThis.fetch = async (_url, options) => {
    assert.equal(JSON.parse(options.body).reporter.name, 'PRIVATE_AUTHOR', 'submission preserves internal author');
    return new Response(JSON.stringify({ ok: true, reportId: 7, player: {nickname: 'Player', rid: '123'} }), { status: 201 });
  };
  const submission = {
    body: { report: {nickname: 'Player', rid: '123', reason: 'Motivo documentado', investigation_status: 'resolved'}, reporter: {name: 'PRIVATE_AUTHOR'}, evidence: [] },
    wordpressReportsConfig: { enabled: true, baseUrl: 'http://wp.test', apiSecret: 'test-secret', timeoutMs: 1000 },
    logger: { info() {}, warn() {}, error() {} },
    refreshPlayerCase: async (player) => { refreshed++; assert.deepEqual(player, {nickname: 'Player', rid: 123, reportId: 7}); },
  };
  const saved = await submitWordpressReport(submission);
  assert.equal(saved.status, 201);
  assert.equal(refreshed, 1, 'saving a new report triggers summary refresh');
  const savedWithWarning = await submitWordpressReport({ ...submission, refreshPlayerCase: async () => { throw new Error('AI offline'); } });
  assert.equal(savedWithWarning.status, 201, 'AI failure never pretends report persistence failed');
  assert.ok(savedWithWarning.payload.warning, 'successful report with AI failure surfaces an explicit warning');
  const invalid = await submitWordpressReport({ ...submission, body: {} });
  assert.equal(invalid.status, 400);
  assert.equal(refreshed, 1, 'invalid reports do not trigger AI');
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(rootDir, { recursive: true, force: true });
}
console.log('OK persisted AI classification, invalidation, privacy, retry and concurrency checks');
