import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import express from 'express';
import { registerCasesRoutes } from './cases.routes.js';
import { registerExpedientesRoutes } from './expedientes.routes.js';
import { calculatePriority, matchReports, publicReport, createCaseReportsSource } from '../services/caseReports.service.js';
import { readCase, manageCase, staffCase } from '../services/cases.service.js';
import { readExpedientes, publicLegacyExpediente, updateExpedientes } from '../services/expedientesStore.service.js';
import { createDiscordStaffVerifier } from '../../../shared/auth/discordStaff.js';

const rootDir = path.resolve(`.case-tests-${crypto.randomUUID()}`);
const report = (id, severity = 'alta', up = 4, down = 0) => publicReport({
  id, nickname: 'Player', rid: '123', severity, createdAt: '2026-10-01',
  reporter: { id: 'PRIVATE_DISCORD', name: 'PRIVATE_REPORTER', tag: 'PRIVATE_TAG' }, ip: 'PRIVATE_IP',
  notes: 'PRIVATE_NOTE', metadata: { notes: 'PRIVATE_META' },
  communityVerification: { up, down, confirmations: [{ voterIp: 'PRIVATE_IP' }], votesByVoter: { PRIVATE: true } },
});
assert.equal(calculatePriority([report(1)]).level, 'high');
assert.equal(calculatePriority([report(1, 'alta', 5)]).level, 'critical');
assert.equal(calculatePriority([report(1, 'critica', 500)]).level, 'critical');
assert.equal(calculatePriority([report(1, 'baja', 5), report(2, 'alta', 4)]).reportId, 2);
assert.equal(calculatePriority([report(1, 'baja', 3), report(2, 'baja', 3)]).level, 'low');
assert.equal(calculatePriority([report(1, '', 100)]).level, 'undetermined');
assert.equal(calculatePriority([{ ...report(1), validation: 'rechazado' }]).level, 'undetermined');
assert.equal(calculatePriority([report(1, 'alta', 0, 100)]).level, 'high');
assert.equal(calculatePriority([report(1, 'media', 8, 4)]).level, 'normal');
assert.equal(calculatePriority([report(1, 'media', 9, 4)]).level, 'high');
assert.equal(JSON.stringify(report(1)).includes('PRIVATE'), false);
assert.deepEqual(matchReports([report(1), report(1), { ...report(2), rid: '999' }, { ...report(3), rid: null }],
  { nickname: 'Player', rid: '123' }).map((item) => item.id), [1, 3]);
assert.deepEqual(matchReports([report(1)], { nickname: 'Player', rid: '999' }), []);

let reports = [report(1)];
let unavailable = false;
const source = async () => { if (unavailable) throw new Error('offline'); return reports; };
let server;
try {
  const empty = await readCase({ rootDir, source: async () => [], nickname: 'Empty' });
  assert.equal(empty.payload.case, null);
  assert.equal(readExpedientes(rootDir).length, 0);
  const first = await readCase({ rootDir, source, nickname: 'Player', rid: '123' });
  const id = first.payload.case.id;
  const byName = await readCase({ rootDir, source, nickname: 'Player' });
  assert.equal(byName.payload.case.id, id, 'name with single RID resolves existing identity');
  const homonyms = await readCase({ rootDir, source: async () => [
    { ...report(50), nickname: 'Homonym', rid: '50' }, { ...report(51), nickname: 'Homonym', rid: '51' },
  ], nickname: 'Homonym' });
  assert.equal(homonyms.status, 409);
  assert.equal(homonyms.payload.candidates.length, 2);
  const ambiguity = await readCase({ rootDir, source: async () => [report(1), { ...report(2), rid: '999' }], nickname: 'Other' });
  assert.equal(ambiguity.payload.case, null);
  const ambiguousPlayer = await readCase({ rootDir, source: async () => [report(1), { ...report(2), rid: '999' }], nickname: 'PlayerX' });
  assert.equal(ambiguousPlayer.payload.case, null);
  assert.equal((await readCase({ rootDir, source, id })).payload.case.id, id);
  manageCase({ rootDir, id, user: { id: 'STAFF_PRIVATE', username: 'Staff' }, text: 'STAFF_NOTE_PRIVATE' });
  manageCase({ rootDir, id, user: { id: 'STAFF_PRIVATE' }, status: 'closed', reason: 'STAFF_REASON_PRIVATE' });
  updateExpedientes(rootDir, (items) => {
    items[0].notes = ['LEGACY_PRIVATE'];
    items[0].reports = [{ metadata: { notes: 'LEGACY_META_PRIVATE' }, reporter: { id: 'LEGACY_ID_PRIVATE', name: 'PRIVATE_REPORTER' } }];
    items[0].votes = { legit: 1000, not_legit: 0, entries: [] };
  });
  reports = [report(1), report(2, 'media', 5)];
  const refreshed = await readCase({ rootDir, source, id });
  assert.equal(refreshed.payload.case.status, 'closed');
  assert.equal(refreshed.payload.case.priority.level, 'high');
  assert.equal(JSON.stringify(refreshed).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(publicLegacyExpediente(readExpedientes(rootDir)[0])).includes('PRIVATE'), false);
  assert.equal(readExpedientes(rootDir)[0].history.at(-1).type, 'new_reports_on_closed_case');
  unavailable = true;
  updateExpedientes(rootDir, (items) => {
    items[0].caseSnapshot.reports[0].reporter = { name: 'PRIVATE_OLD_SNAPSHOT' };
  });
  const stale = await readCase({ rootDir, source, id });
  assert.equal(stale.payload.source.stale, true);
  assert.equal(JSON.stringify(stale).includes('PRIVATE'), false, 'old snapshots are sanitized even during source outages');
  assert.equal(stale.payload.case.priority.level, 'high');
  assert.equal((await readCase({ rootDir, source, nickname: 'Unknown' })).status, 502);
  unavailable = false;

  let role = true;
  const verifyCaseStaff = createDiscordStaffVerifier({
    discordAuth: { apiUrl: 'https://discord.test' }, guildId: 'guild', roleIds: new Set(['staff']),
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ roles: role ? ['staff'] : [] }) }),
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (req.headers['x-test-auth'] === 'yes') req.session = {
      authUser: { id: 'STAFF_PRIVATE', username: 'Staff' },
      discordToken: { accessToken: 'TOKEN_PRIVATE', scope: 'guilds.members.read', expiresAt: Date.now() + 600000 },
    };
    next();
  });
  let summaryCalls = 0;
  const deps = { rootDir, generateCaseSummary: async () => { summaryCalls++; return 'Resumen público de denuncias no verificadas.'; }, rateLimits: {
    general: (_req, _res, next) => next(), webhook: (_req, _res, next) => next(),
  }, requireBodyObject: (_req, _res, next) => next(), verifyCaseStaff, getCaseReports: source };
  registerCasesRoutes(app, deps);
  registerExpedientesRoutes(app, deps);
  server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  const base = `http://127.0.0.1:${server.address().port}/api/cases/${id}`;
  const publicRead = await (await fetch(base)).json();
  assert.equal(publicRead.case.classification.text, 'Resumen público de denuncias no verificadas.');
  assert.equal(publicRead.case.classification.stale, false);
  await fetch(base);
  assert.equal(summaryCalls, 1, 'HTTP reads reuse the persisted classification');
  assert.equal((await fetch(`${base}/staff`)).status, 401);
  const headers = { 'x-test-auth': 'yes', 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/staff`, { headers })).status, 200);
  role = false;
  assert.equal((await fetch(`${base}/staff`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/notes`, { method: 'POST', headers, body: '{"text":"denied"}' })).status, 403);
  const legacyUrl = `http://127.0.0.1:${server.address().port}/api/expedientes/report`;
  assert.equal((await fetch(legacyUrl, { method: 'POST', headers,
    body: JSON.stringify({ player: { nickname: 'Player', rid: '123' }, notes: 'denied legacy note' }) })).status, 403);
  role = true;
  assert.equal((await fetch(`${base}/status`, { method: 'PATCH', headers, body: '{"status":"closed","reason":""}' })).status, 400);
  assert.equal((await fetch(`${base}/notes`, { method: 'POST', headers, body: '{"text":""}' })).status, 400);
  const results = await Promise.all(Array.from({ length: 30 }, (_, i) => fetch(
    `${base}/${i % 2 ? 'notes' : 'status'}`, { method: i % 2 ? 'POST' : 'PATCH', headers,
      body: JSON.stringify(i % 2 ? { text: `concurrent-${i}`, author: { id: 'FORGED' } }
        : { status: i % 4 ? 'investigating' : 'open', reason: `reason-${i}` }) })));
  assert.ok(results.every((result) => result.ok));
  const stored = readExpedientes(rootDir)[0];
  assert.equal(stored.staffNotes.length, 16);
  assert.equal(stored.history.filter((entry) => entry.type === 'status_changed').length, 16);
  assert.ok(stored.staffNotes.every((note) => note.author.id === 'STAFF_PRIVATE'));
  assert.equal(JSON.stringify(await (await fetch(base)).json()).includes('PRIVATE'), false);
  assert.equal((await readCase({ rootDir, source, id })).payload.case.id, id);
  assert.ok(fs.existsSync(path.join(rootDir, 'data', 'expedientes.json')));
  const moduleUrl = pathToFileURL(path.resolve('server', 'modules', 'expedientes', 'services', 'cases.service.js')).href;
  const childCode = `import { manageCase } from ${JSON.stringify(moduleUrl)};
    for (let i = 0; i < 10; i++) manageCase({ rootDir: ${JSON.stringify(rootDir)}, id: ${JSON.stringify(id)},
      user: { id: 'CHILD_PRIVATE', username: 'Child' }, text: 'process-note-' + i });`;
  await Promise.all(Array.from({ length: 3 }, () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', childCode], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    child.stderr.on('data', (data) => { errors += data; });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(errors)));
  })));
  assert.equal(readExpedientes(rootDir)[0].staffNotes.length, 46, 'separate processes preserve every note');
  assert.equal(readExpedientes(rootDir)[0].votes.legit, 1000, 'legacy votes preserved but never added to WP priority');
  const legacyWrite = await fetch(legacyUrl, { method: 'POST', headers,
    body: JSON.stringify({ player: { nickname: 'Player', rid: '123' }, notes: 'AUTHORIZED_NOTE_PRIVATE' }) });
  assert.equal(legacyWrite.status, 201);
  assert.equal(JSON.stringify(await legacyWrite.json()).includes('PRIVATE'), false);
  assert.equal(readExpedientes(rootDir)[0].staffNotes.at(-1).author.id, 'STAFF_PRIVATE');
  assert.deepEqual(readExpedientes(rootDir)[0].notes, ['LEGACY_PRIVATE'], 'legacy unattributed text is not rewritten');
  // Corruption is an explicit failure, not an empty database that a later write can destroy.
  fs.writeFileSync(path.join(rootDir, 'data', 'expedientes.json'), '{broken');
  assert.equal((await fetch(`${base}/notes`, { method: 'POST', headers, body: '{"text":"must fail"}' })).status, 503);
  assert.equal(fs.readFileSync(path.join(rootDir, 'data', 'expedientes.json'), 'utf8'), '{broken');

  let pages = 0;
  const paginated = createCaseReportsSource({ config: { enabled: true, baseUrl: 'https://wp.test' }, fetchImpl: async () => {
    pages++;
    return { ok: true, json: async () => ({ ok: true, items: pages === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: i })) : [{ id: 101 }] }) };
  } });
  assert.equal((await paginated({ rid: '123' })).length, 101);
  assert.equal(pages, 2);
  const migrationRoot = path.join(rootDir, 'legacy-migration');
  updateExpedientes(migrationRoot, (items) => items.push({
    expedienteId: 'exp-legacy', playerKey: 'rid:777', player: { nickname: 'Legacy', rid: '777' },
    notes: ['OLD_PRIVATE'], reports: [{ reportId: 'old-rep', metadata: { notes: 'ORIGINAL_PRIVATE' } }],
    votes: { legit: 80, not_legit: 2, entries: [] }, createdAt: '2020-01-01', updatedAt: '2020-01-01',
  }));
  const migrated = await readCase({ rootDir: migrationRoot, nickname: 'Legacy', rid: '777',
    source: async () => [{ ...report(777, 'baja', 0), nickname: 'Legacy', rid: '777' }] });
  assert.equal(migrated.payload.case.id, 'exp-legacy');
  assert.equal(migrated.payload.case.priority.level, 'low', 'old local votes cannot boost WordPress reports');
  const preserved = readExpedientes(migrationRoot)[0];
  assert.equal(preserved.createdAt, '2020-01-01');
  assert.deepEqual(preserved.notes, ['OLD_PRIVATE']);
  assert.equal(preserved.reports[0].metadata.notes, 'ORIGINAL_PRIVATE');
  assert.equal(preserved.votes.legit, 80);
  updateExpedientes(migrationRoot, (items) => {
    const item = items[0];
    item.status = 'closed';
    item.history = [
      { type: 'status_changed', to: 'closed', createdAt: '2026-10-01T12:00:00.000Z' },
      { type: 'status_changed', to: 'open', createdAt: '2026-10-02T12:00:00.000Z' },
      { type: 'status_changed', to: 'closed', createdAt: '2026-10-03T12:00:00.000Z' },
    ];
    item.caseSnapshot = {
      fetchedAt: new Date().toISOString(),
      reports: [
        { id: 1, createdAt: '2026-10-02T12:00:00.000Z' },
        { id: 2, createdAt: '2026-10-03T12:00:00.000Z' },
        { id: 3, createdAt: '2026-10-04T12:00:00.000Z' },
        { id: 4, createdAt: null }, { id: 5, createdAt: 'invalid' },
      ],
    };
  });
  const beforeStaffRead = fs.readFileSync(path.join(migrationRoot, 'data', 'expedientes.json'), 'utf8');
  assert.deepEqual(staffCase({ rootDir: migrationRoot, id: 'exp-legacy' }).closedCaseNewReports, {
    count: 1, reportIds: [3], closedAt: '2026-10-03T12:00:00.000Z',
  });
  assert.equal(fs.readFileSync(path.join(migrationRoot, 'data', 'expedientes.json'), 'utf8'), beforeStaffRead,
    'closed case warning is read-only and never reopens the case');
  updateExpedientes(migrationRoot, (items) => { items[0].status = 'investigating'; });
  assert.deepEqual(staffCase({ rootDir: migrationRoot, id: 'exp-legacy' }).closedCaseNewReports.reportIds, []);
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  fs.rmSync(rootDir, { recursive: true, force: true });
}
console.log('OK case priority / privacy / snapshots / persistent concurrent staff mutations');
