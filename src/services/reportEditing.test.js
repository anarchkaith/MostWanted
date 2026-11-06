import assert from 'node:assert/strict';
import test from 'node:test';
import { reportEditDraft, saveReportEdits } from './reportEditing.js';

test('editing starts from the actual report rather than aggregate or externally investigated data', () => {
  assert.deepEqual(reportEditDraft({
    nickname: 'Actual', content: 'Actual reason', rid: '123', categories: ['MODDER', 'OLD'],
    labels: [{ label: 'Aimbot', detail: 'Keep on server' }, 'Legacy'],
    crews: [{ name: 'Crew', url: 'https://crew.test' }], aliases: ['Old'],
  }), { nickname: 'Actual', reason: 'Actual reason', rid: '123', crews: 'Crew', typesOfInfraction: ['MODDER', 'OLD'], labels: ['Aimbot', 'Legacy'], aliases: 'Old' });
});

test('saves retained evidence by original index and uploads only new images; immutable fields are not submitted', async () => {
  let uploaded;
  let saved;
  const result = await saveReportEdits({
    values: { nickname: ' Name ', reason: 'Changed reason', crews: '', typesOfInfraction: ['MODDER'], labels: ['Aimbot'], rid: 'injection', ownerDiscordId: 'victim' },
    originalEvidence: [2, 0], images: [{ name: 'New' }], revision: 'old',
    upload: async images => { uploaded = images; return [{ url: 'https://evidence.test/new.png', name: 'New', contentType: 'image/png' }]; },
    save: async payload => { saved = payload; return { ok: true }; },
  });
  assert.equal(uploaded.length, 1);
  assert.deepEqual(saved, {
    revision: 'old', changes: { nickname: 'Name', reason: 'Changed reason', crews: '', typesOfInfraction: ['MODDER'], labels: ['Aimbot'],
      evidence: [{ _original: 2 }, { _original: 0 }, { url: 'https://evidence.test/new.png', name: 'New', contentType: 'image/png' }] },
  });
  assert.equal(result.ok, true);
});

test('failed, incomplete or unsafe uploads never save edits; no new images need no upload service', async () => {
  const params = {
    values: { nickname: 'Name', reason: 'Reason', crews: '', typesOfInfraction: [], labels: [] },
    originalEvidence: [], images: [{}], revision: 'old', save: () => assert.fail('Saved after upload failure'),
  };
  for (const upload of [async () => { throw new Error('failed'); }, async () => [], async () => [{ url: 'javascript:alert(1)' }], async () => [{ url: '' }]]) {
    await assert.rejects(saveReportEdits({ ...params, upload }));
  }
  await saveReportEdits({ ...params, images: [], upload: () => assert.fail('Uploaded nothing'),
    save: async payload => { assert.deepEqual(payload.changes.evidence, []); return { ok: true }; } });
});
