import assert from 'node:assert/strict';
import test from 'node:test';
import { firstInvalidReportStep, reportStepIssues } from './reportWizard.js';

test('validation errors lead to the first relevant wizard step', () => {
  assert.equal(firstInvalidReportStep({}), -1);
  assert.equal(firstInvalidReportStep({ typesOfInfraction: 'Elige una categoría' }), 1);
  assert.equal(firstInvalidReportStep({ reason: 'Escribe un motivo', typesOfInfraction: 'Elige una categoría' }), 0);
  assert.equal(firstInvalidReportStep({ rid: 'RID inválido', reason: 'Escribe un motivo' }), 0);
  assert.equal(firstInvalidReportStep({ reason: 'Escribe un motivo' }), 0);
});

test('step issues preserve field names and messages without leaking other steps', () => {
  const errors = {
    nickname: 'El nickname es obligatorio',
    typesOfInfraction: 'Seleccioná al menos una categoría',
    evidence: ['Imagen inválida'],
  };
  assert.deepEqual(reportStepIssues(errors, 0), [
    { field: 'nickname', messages: ['El nickname es obligatorio'] },
    { field: 'evidence', messages: ['Imagen inválida'] },
  ]);
  assert.deepEqual(reportStepIssues(errors, 1), [{ field: 'typesOfInfraction', messages: ['Seleccioná al menos una categoría'] }]);
});

test('unexpected validation errors remain visible instead of being ignored', () => {
  const errors = { extra: 'Dato inválido' };
  assert.equal(firstInvalidReportStep(errors), 0);
  assert.deepEqual(reportStepIssues(errors, 0), [{ field: 'extra', messages: ['Dato inválido'] }]);
  assert.throws(() => reportStepIssues({}, 2), RangeError);
});
