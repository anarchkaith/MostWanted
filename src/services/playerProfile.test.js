import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePlayerProfile } from './playerProfile.js';
import { completeReportPlayerDraft, reportPlayerDraft } from './reportPlayerDraft.js';
import { playerPath, readPlayerRoute } from './playerRoute.js';
import { getPlayerAvatarUrl } from './playerAvatars.js';

test('combines current SC identity with archived and reported values without hiding sources', () => {
  const result = mergePlayerProfile({
    username: 'OldName', rid: '123',
    profile: { name: 'NewName', nameHistory: [{ name: 'OldName', time: 100 }], crews: [{ name: 'CurrentCrew' }], activeCrew: { name: 'ActiveCrew' } },
    reportInsights: {
      username: 'OldName', names: [{ name: 'OldName', time: 200 }],
      crews: ['OldCrew'], avatars: ['https://images.test/old.png'],
      avatarHistory: [{ url: 'https://images.test/older.png', lastSeen: 50 }],
    },
    reports: [{ id: 7, usuario: 'ReportedName', aliases: ['OtherName'], fecha: '2026-01-01', crews: [{ name: 'ReportedCrew' }], avatar1: 'https://images.test/old.png' }],
  });

  assert.equal(result.name, 'NewName');
  assert.deepEqual(new Set(result.aliases), new Set(['NewName', 'OldName', 'ReportedName', 'OtherName']));
  assert.equal(result.nameHistory.filter(entry => entry.name === 'OldName').length, 1);
  assert.equal(result.nameHistory.find(entry => entry.name === 'OldName').observations[0].time, 100);
  assert.deepEqual(new Set(result.crews), new Set(['CurrentCrew', 'ActiveCrew', 'OldCrew', 'ReportedCrew']));
  assert.equal(result.historicalAvatars.length, 2);
  assert.match(result.historicalAvatars[0].source, /Reporte #7/);
  assert.doesNotMatch(JSON.stringify(result), /WordPress/);
  assert.equal(new Date(result.historicalAvatars[0].time * 1000).getDate(), 1, 'date-only reports retain their local calendar day');
});

test('completing player data preserves manual edits and ignores responses for a different name', () => {
  const values = { nickname: 'Known', rid: '', aliases: 'ManualAlias', crews: '', avatar1: 'https://images.test/manual.png', reason: 'New evidence' };
  const player = {
    nickname: 'Known', investigationCompleted: true,
    investigation: { rid: '123', profile: { aliases: ['Archive'], crews: ['Crew'] }, avatares: [{ avatarUrl: 'https://images.test/current.png' }] },
  };
  const completed = completeReportPlayerDraft(values, player);
  assert.equal(completed.rid, '123');
  assert.equal(completed.investigation_status, 'resolved');
  assert.equal(completed.aliases, 'ManualAlias');
  assert.equal(completed.avatar1, values.avatar1);
  assert.equal(completed.crews, 'Crew');
  assert.equal(completed.reason, values.reason);
  const renamed = { ...values, nickname: 'DifferentAccount' };
  assert.equal(completeReportPlayerDraft(renamed, player), renamed);
  assert.equal(completeReportPlayerDraft(renamed, { ...player, rid: '123' }).rid, '123');
  assert.equal(completeReportPlayerDraft(values, { nickname: 'Known', investigationCompleted: true }).investigation_status, 'not_found');
});

test('unknown and archived-only profiles remain reportable without invented external data', () => {
  const unknown = mergePlayerProfile({ username: 'Unknown' });
  assert.equal(unknown.name, 'Unknown');
  assert.deepEqual(unknown.historicalAvatars, []);
  assert.deepEqual(unknown.crews, []);
  const archived = mergePlayerProfile({ reportInsights: { username: 'Archive', names: ['Alias'], crews: ['Crew'] } });
  assert.equal(archived.name, 'Archive');
  assert.equal(archived.crewHistory[0].source, '');
  assert.equal(archived.nameHistory[0].time, 0);
});

test('groups names and crews across report aggregates and preserves distinct report references only once', () => {
  const result = mergePlayerProfile({
    profile: { name: 'Current_Name', nameHistory: [{ name: 'Current_Name', time: 100 }], aliases: ['Current_Name'] },
    reportInsights: { username: 'Current_Name', names: [{ name: 'Current_Name', time: 100 }], crews: ['spacys'], crewHistory: [{ name: 'spacys', lastSeen: 100 }] },
    reports: [
      { id: 6789, nickname: 'Current_Name', aliases: ['current_name'], crews: ['spacys', { name: 'SPACYS' }], createdAt: '2026-10-19T11:13:46Z' },
      { id: 6790, nickname: 'current_name', crews: ['spacys'], createdAt: '2026-10-20T11:13:46Z' },
    ],
  });
  assert.equal(result.nameHistory.length, 1);
  assert.equal(result.crewHistory.length, 1);
  assert.deepEqual(result.crewHistory[0].observations.map(item => item.source), ['Reporte #6789', 'Reporte #6790']);
  assert.equal(result.nameHistory[0].observations.filter(item => item.reportId === 6789).length, 1);
  assert.ok(result.crewHistory[0].observations.every(item => item.time > 0));
  assert.doesNotMatch(JSON.stringify(result), /WordPress/);
});

test('avatar history excludes both current Rockstar slots and explicitly supplied current URLs', () => {
  const current = getPlayerAvatarUrl('123');
  const second = getPlayerAvatarUrl('123', 1);
  const custom = 'https://images.test/current.png';
  const old = 'https://images.test/previous.png';
  const result = mergePlayerProfile({
    rid: '123', currentAvatars: [{ avatarUrl: custom }],
    reportInsights: { avatars: [current, second, custom, old], avatarHistory: [{ url: current }, { url: old, lastSeen: 100 }] },
    reports: [{ id: 1, avatar1: current, avatar2: old }, { id: 2, avatar1: second, avatar2: custom }],
  });
  assert.deepEqual(result.historicalAvatars.map(item => item.avatarUrl), [old]);
  assert.equal(result.historicalAvatars[0].source, 'Reporte #1');
});

test('player routes preserve exact names and support legacy case and user links', () => {
  for (const name of ['Sazxxin', 'Mixed_Name', 'case-player', 'Name With Space', 'Player#One']) {
    assert.equal(readPlayerRoute(playerPath(name)).player.nickname, name);
  }
  assert.equal(playerPath('Mixed_Name'), '/jugador/Mixed_Name');
  assert.equal(readPlayerRoute('/usuario/Mixed_Name').player.nickname, 'Mixed_Name');
  const id = 'case-328bbec5-9d20-4832-83b6-d0e0d05a9567';
  assert.equal(readPlayerRoute(`/jugador/${id}`).caseId, id);
  assert.equal(readPlayerRoute('/').player, null);
  assert.match(readPlayerRoute('/jugador/%E0').error, /inválido/);
});

test('draft carries resolved data and accepts new reports when no sources matched', () => {
  const draft = reportPlayerDraft({
    nickname: 'OldName', rid: '123', investigationCompleted: true,
    investigation: {
      nombre: 'NewName', rid: '123',
      profile: { aliases: ['OldName', 'NewName'], crews: ['Crew'] },
      avatares: [{ avatarUrl: 'https://images.test/current.png' }],
    },
  });
  assert.equal(draft.nickname, 'NewName');
  assert.equal(draft.rid, '123');
  assert.equal(draft.investigation_status, 'resolved');
  assert.equal(draft.aliases, 'OldName, NewName');
  assert.equal(draft.crews, 'Crew');
  assert.equal(draft.avatar1, 'https://images.test/current.png');
  const unknown = reportPlayerDraft({ nickname: 'Unknown', investigationCompleted: true });
  assert.equal(unknown.investigation_status, 'not_found');
  assert.equal(unknown.nickname, 'Unknown');
  assert.equal(unknown.rid, '');
  const offline = reportPlayerDraft({ nickname: 'Known', rid: '123', investigationCompleted: true });
  assert.equal(offline.rid, '123');
  assert.equal(offline.investigation_status, 'resolved');
  assert.equal(reportPlayerDraft({
    rid: '123', investigationCompleted: true, investigation: { nombre: 'RID 123', rid: '123' },
  }).nickname, '', 'RID placeholders must not be saved as reported nicknames');
});
