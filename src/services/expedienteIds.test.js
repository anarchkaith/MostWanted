import assert from 'node:assert/strict';
import { assignExpedienteIds } from './expedienteIds.js';

const newestFirst = [
  { id: 30, fecha: '2026-03-01T12:00:00.000Z' },
  { id: 20, fecha: '2026-02-01T12:00:00.000Z' },
  { id: 10, fecha: '2026-01-01T12:00:00.000Z' },
];

assert.deepEqual(
  assignExpedienteIds(newestFirst).map(({ id, expedienteId }) => ({ id, expedienteId })),
  [
    { id: 30, expedienteId: 3 },
    { id: 20, expedienteId: 2 },
    { id: 10, expedienteId: 1 },
  ],
);

assert.deepEqual(
  assignExpedienteIds([
    { id: 22, fecha: '2026-01-01T12:00:00.000Z' },
    { id: 21, fecha: '2026-01-01T12:00:00.000Z' },
  ]).map(({ id, expedienteId }) => ({ id, expedienteId })),
  [
    { id: 22, expedienteId: 2 },
    { id: 21, expedienteId: 1 },
  ],
);

console.log('OK expediente numbering checks completed');
