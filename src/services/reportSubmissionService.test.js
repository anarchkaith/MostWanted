import assert from 'node:assert/strict';
import test from 'node:test';
import { uploadEvidenceImages } from './reportSubmissionService.js';
import { runReportSubmission } from './reportSubmissionWorkflow.js';

test('a failed upload waits for remaining uploads and prevents report creation', async () => {
  const originalFetch = globalThis.fetch;
  let complete;
  const pending = new Promise(resolve => { complete = resolve; });
  globalThis.fetch = async (_url, { body }) => {
    if (body.get('image') === 'FAIL') return Response.json({ success: false }, { status: 400 });
    await pending;
    return Response.json({ success: true, data: { url: 'https://example.test/proof.png' } });
  };
  try {
    let finished = false;
    const operation = runReportSubmission({
      values: { nickname: 'Player' },
      images: [{ name: 'Falla.png', base64: 'FAIL' }, { name: 'Lenta.png', base64: 'SLOW' }],
      apiKey: 'fixture-key',
      upload: uploadEvidenceImages,
      save: () => assert.fail('Created a report after an upload failed'),
      onSaved: () => assert.fail('Refreshed a report after an upload failed'),
    });
    const rejection = assert.rejects(operation, /Falla\.png/).finally(() => { finished = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    complete();
    await rejection;
  } finally {
    complete();
    globalThis.fetch = originalFetch;
  }
});

test('successful upload results retain every selected file in order', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, { body }) => Response.json({
    success: true, data: { url: `https://example.test/${body.get('image')}.png` },
  });
  try {
    const results = await uploadEvidenceImages([
      { name: 'Uno.png', base64: 'ONE', type: 'image/png', size: 12 },
      { name: 'Dos.png', base64: 'TWO', type: 'image/png', size: 34 },
    ], 'fixture-key');
    assert.deepEqual(results.map(item => item.url), ['https://example.test/ONE.png', 'https://example.test/TWO.png']);
    assert.deepEqual(results.map(item => item.name), ['Uno.png', 'Dos.png']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
