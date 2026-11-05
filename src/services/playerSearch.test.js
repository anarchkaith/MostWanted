import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePlayerMatches, publicSearchFields, searchFieldMatches, searchExcerpt, fetchArchiveSearch } from './playerSearch.js';
import { playerCandidates, filterCaseReports } from './casePresentation.js';
import { mapWordpressReportToReporte } from './reportViewModel.js';

const report = mapWordpressReportToReporte({
  id: 9, nickname: 'Player', rid: '123', reason: 'Provocó una expulsión de la sesión.',
  categories: ['MODDER'], labels: [{ label: 'Godmode', detail: 'Daño ignorado' }],
  crews: [{ name: 'Rebels', url: 'https://private-url.test' }],
  analysis: { summary: 'Reincidencia durante carreras nocturnas.', recommendation: 'Revisar teletransporte.' },
  reporter: { name: 'PrivateReporter' }, ip: 'private-ip', privateIdentity: { email: 'private-email' },
});

test('unified search finds general words in reports, categories, crews and saved summaries', () => {
  for (const query of ['expulsion', 'GODMODE', 'daño', 'rebels', 'carreras', 'teletransporte', 'modder', '123', 'Player']) {
    const matches = mergePlayerMatches(playerCandidates([report], query), [], query);
    assert.equal(matches.length, 1, query);
    assert.equal(matches[0].rid, '123');
  }
  assert.equal(filterCaseReports([report], { query: 'carreras' }).length, 1);
  assert.equal(mergePlayerMatches([], [{ nickname: 'Other', aiSummary: { text: 'Conducta recurrente en carreras' } }], 'recurrente').length, 1);
});

test('multiple words may match distinct public fields, but every word must be present', () => {
  assert.equal(playerCandidates([report], 'modder expulsion').length, 1);
  assert.equal(playerCandidates([report], 'modder inexistente').length, 0);
  assert.equal(searchFieldMatches(publicSearchFields(report), '  ').length, 0);
});

test('private identity, reporters, IPs, URLs and arbitrary object fields are not searchable', () => {
  const item = { ...report, reportadoPor: 'PrivateReporter', ip: 'private-ip',
    privateIdentity: { email: 'private-email' }, analysis: { ...report.analysis, internal: 'private-analysis' } };
  for (const query of ['PrivateReporter', 'private-ip', 'private-email', 'private-url', 'private-analysis']) {
    assert.equal(playerCandidates([item], query).length, 0, query);
    assert.equal(filterCaseReports([item], { query }).length, 0, query);
  }
});

test('keyword matches survive merging and different RIDs are never combined', () => {
  const query = 'carreras';
  const matches = mergePlayerMatches(playerCandidates([report], query), [
    { nickname: 'Player', rid: '123', aiSummary: { text: 'Resumen de carreras' } },
    { nickname: 'Player', rid: '456', aiSummary: { text: 'Resumen de carreras' } },
  ], query);
  assert.equal(matches.length, 2);
  assert.equal(matches.find(item => item.rid === '123').count, 1);
  assert(matches.find(item => item.rid === '123').searchMatches.some(item => item.reportId === 9));
  assert.equal(mergePlayerMatches([], [{ nickname: 'Player', matchedQuery: 'otro', searchMatches: [{ field: 'Motivo', text: 'sin coincidencias' }] }], query).length, 0);
});

test('server matches remain selectable even when excerpts omit one of multiple search terms', () => {
  const matches = mergePlayerMatches([], [{
    nickname: 'Player', rid: '123', matchedQuery: 'carreras nocturnas',
    searchMatches: [{ field: 'Resumen', text: 'carreras …', reportId: 9 }],
  }], 'carreras nocturnas');
  assert.equal(matches.length, 1);
});

test('excerpt includes a keyword late in a long summary', () => {
  const text = `${'Introducción '.repeat(100)}teletransporte observado`;
  const excerpt = searchExcerpt(text, 'teletransporte');
  assert(excerpt.includes('teletransporte'));
  assert(excerpt.startsWith('…'));
  assert(excerpt.length <= 162);
});

test('archive request preserves query, pagination and cancellation and surfaces errors', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = async (url, options) => {
    assert.equal(new URL(url).searchParams.get('q'), 'carreras & expulsión');
    assert.equal(new URL(url).searchParams.get('page'), '2');
    assert.equal(options.signal, controller.signal);
    return Response.json({ ok: true, items: [], total: 0, hasMore: false });
  };
  try {
    const buildUrl = path => `https://api.test${path}`;
    const result = await fetchArchiveSearch({ query: 'carreras & expulsión', page: 2, signal: controller.signal }, buildUrl);
    assert.equal(result.total, 0);
    globalThis.fetch = async () => Response.json({ ok: false, error: 'Plugin no actualizado' }, { status: 502 });
    await assert.rejects(fetchArchiveSearch({ query: 'carreras' }, buildUrl), /Plugin no actualizado/);
    globalThis.fetch = async () => Response.json({ ok: true, items: [] });
    await assert.rejects(fetchArchiveSearch({ query: 'carreras' }, buildUrl), /formato inválido/);
  } finally { globalThis.fetch = originalFetch; }
});
