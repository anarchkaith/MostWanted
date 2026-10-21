import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiResponse } from './jsonResponse.js';

test('JSON parsing rejects HTML, empty, scalar and array responses without exposing syntax errors', async () => {
  for (const raw of ['<!DOCTYPE html><h1>Missing</h1>', '', 'null', '[]', '"ok"']) {
    await assert.rejects(readApiResponse(new Response(raw), 'No se pudo consultar.'), error => {
      assert.match(error.message, /^No se pudo consultar/);
      assert.doesNotMatch(error.message, /Unexpected token/);
      return true;
    });
  }
});

test('HTTP and application errors preserve the provider message while valid objects pass through', async () => {
  await assert.rejects(readApiResponse(Response.json({ error: 'Sesión expirada' }, { status: 401 }), 'Fallback'), /Sesión expirada/);
  await assert.rejects(readApiResponse(Response.json({ ok: false, message: 'Motivo obligatorio' }), 'Fallback'), /Motivo obligatorio/);
  await assert.rejects(readApiResponse(Response.json({ error: { internal: 'Do not stringify' } }, { status: 500 }), 'Fallback'), /Fallback/);
  assert.deepEqual(await readApiResponse(Response.json({ ok: true, items: [] }), 'Fallback'), { ok: true, items: [] });
});

test('cancellation during response parsing remains cancellation', async () => {
  const error = new DOMException('Cancelled', 'AbortError');
  await assert.rejects(readApiResponse({ json: async () => { throw error; } }, 'Fallback'), cause => cause === error);
});
