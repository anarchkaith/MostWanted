import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readCase } from './cases.service.js';
import { readExpedientes, updateExpedientes } from './expedientesStore.service.js';
import { createCaseSummaryPublisher } from './caseSummaryPublication.service.js';

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mostwanted-summary-publication-'));
const originalFetch = globalThis.fetch;
const logger = { info() {}, error() {} };
let reports = [{ id: 1, nickname: 'Player', rid: '123', reason: 'Motivo inicial', categories: ['MODDER'], createdAt: '2026-10-27' }];
let sourceReports = reports;
let generations = 0;
let reads = 0;
let writes = 0;
let rejectPublication = false;
globalThis.fetch = async (url, options) => {
  assert.ok(options.headers.Authorization, 'Only the backend uses the ingestion secret');
  if (options.method === 'GET') {
    assert.match(url, /\/players\/ai-summary\?/);
    reads++;
    return new Response(JSON.stringify({ ok: true, revision: 'source-revision', reports: sourceReports }));
  }
  writes++;
  const body = JSON.parse(options.body);
  assert.equal(body.sourceRevision, 'source-revision');
  assert.equal(body.text, `Resumen ${generations}`);
  return new Response(JSON.stringify({ ok: !rejectPublication }), { status: rejectPublication ? 409 : 200 });
};
try {
  const publishCaseSummary = createCaseSummaryPublisher({
    rootDir, config: { baseUrl: 'https://wordpress.test', apiSecret: 'test-secret', timeoutMs: 1000 }, logger,
  });
  const query = { rootDir, nickname: 'Player', rid: '123', source: async () => reports,
    generateCaseSummary: async () => `Resumen ${++generations}`, publishCaseSummary };
  await readCase({ ...query, publishCaseSummary: undefined });
  assert.equal(generations, 1);
  assert.equal(writes, 0);
  await readCase(query);
  assert.equal(generations, 1);
  assert.equal(writes, 1, 'Existing summaries are published without generating them again');
  const persisted = readExpedientes(rootDir)[0].aiSummary;
  assert.equal(persisted.publishedFingerprint, persisted.fingerprint);
  await readCase(query);
  reports[0].communityVerification = { up: 9, down: 2 };
  await readCase(query);
  assert.equal(generations, 1, 'Visits and votes do not regenerate AI');
  assert.equal(reads, 1, 'Unchanged summaries do not republish');
  reports = [{ ...reports[0], reason: 'Motivo corregido' }];
  sourceReports = reports;
  await readCase(query);
  assert.equal(generations, 2);
  assert.equal(writes, 2, 'Content changes generate and publish once');

  reports = [{ ...reports[0], reason: 'Cambio concurrente' }];
  sourceReports = reports;
  rejectPublication = true;
  const failed = await readCase(query);
  assert.equal(generations, 3);
  assert.match(failed.payload.case.classification.error, /metadata/);
  assert.equal(readExpedientes(rootDir)[0].aiSummary.text, 'Resumen 3', 'Publication failure never loses the generated summary');
  await readCase(query);
  assert.equal(writes, 3, 'Publication failures have a persisted cooldown');
  assert.equal(generations, 3, 'Publication retries must not generate AI');
  updateExpedientes(rootDir, items => { items[0].aiSummary.publishRetryAfter = '2000-01-01'; });
  rejectPublication = false;
  await readCase(query);
  assert.equal(writes, 4);
  assert.equal(generations, 3);

  reports = [{ ...reports[0], reason: 'Cambio despues del snapshot' }];
  sourceReports = [{ ...reports[0], reason: 'Contenido diferente en WordPress' }];
  const mismatched = await readCase(query);
  assert.equal(writes, 4, 'Never publish a summary against a different WordPress snapshot');
  assert.ok(mismatched.payload.case.classification.error);
  assert.equal(generations, 4);
  console.log('OK persisted AI summary publication, content invalidation, retries, source checks and no generation on votes/visits');
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(rootDir, { recursive: true, force: true });
}
