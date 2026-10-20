import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePlayerProfile } from './playerProfile.js';
import { completeReportPlayerDraft, reportPlayerDraft } from './reportPlayerDraft.js';

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
  assert.equal(result.nameHistory.filter(entry => entry.name === 'OldName').length, 2);
  assert.equal(result.nameHistory.find(entry => entry.source === 'Social Club / sc-cache' && entry.name === 'OldName').time, 100);
  assert.deepEqual(new Set(result.crews), new Set(['CurrentCrew', 'ActiveCrew', 'OldCrew', 'ReportedCrew']));
  assert.equal(result.historicalAvatars.length, 2);
  assert.match(result.historicalAvatars[0].source, /Reporte #7/);
  assert.match(result.historicalAvatars[0].source, /WordPress/);
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
  assert.equal(archived.crewHistory[0].source, 'Archivo WordPress / datos reportados');
  assert.equal(archived.nameHistory[0].time, 0);
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
