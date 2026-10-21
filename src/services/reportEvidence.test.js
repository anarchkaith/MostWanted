import assert from 'node:assert/strict';
import test from 'node:test';
import { reportEvidence } from './reportEvidence.js';

test('evidence accepts WordPress, presentation and legacy inline URL shapes without requests', () => {
  assert.deepEqual(reportEvidence({ evidencias: [{ id: 7, preview: 'https://example.com/proof.png', nombre: 'Prueba', tipo: 'image/webp' }] }),
    [{ id: '7-0', src: 'https://example.com/proof.png', label: 'Prueba', type: 'image/webp' }]);
  const raw = reportEvidence({ evidence: [{ url: 'https://example.com/proof.mp4', name: 'Video', contentType: 'video/mp4' }] });
  assert.equal(raw[0].type, 'video/mp4');
  assert.equal(raw[0].src, 'https://example.com/proof.mp4');
  assert.equal(reportEvidence({ evidencia: 'https://example.com/old.png' })[0].src, 'https://example.com/old.png');
  assert.equal(reportEvidence({ evidencias: ['data:image/png;base64,aGVsbG8='] })[0].src, 'data:image/png;base64,aGVsbG8=');
});

test('legacy IDs and unsafe URLs remain explicit unavailable entries instead of invented endpoints', () => {
  const entries = reportEvidence({ evidencias: [123, '456', { id: 789 }, { preview: 'javascript:alert(1)' }, { preview: 'data:text/html,hello' }] });
  assert.equal(entries.length, 5);
  assert.ok(entries.every(entry => entry.src === ''));
  assert.ok(entries.every(entry => /^Evidencia \d$/.test(entry.label)));
  assert.deepEqual(reportEvidence({}), []);
  assert.equal(reportEvidence({ evidencias: [], evidencia: 'https://example.com/old.png' }).length, 1);
});
