import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAssistantReply } from './assistantChat.js';

function fixture(overrides = {}) {
  const calls = [];
  const warnings = [];
  const controller = new AbortController();
  const options = {
    userText: 'Consulta de prueba',
    messages: [{ role: 'assistant', content: ' Hola ' }, { role: 'user', content: ' Consulta ' }],
    candidateUsuarios: ['Player'],
    buildContext: () => ({ useReportesDb: false }),
    chatEndpoint: '/chat',
    intentEndpoint: '/intent',
    signal: controller.signal,
    logger: { warn: (...args) => warnings.push(args) },
    request: async (endpoint, init) => {
      calls.push({ endpoint, init, body: JSON.parse(init.body) });
      return endpoint === '/intent'
        ? Response.json({ needsReportContext: false })
        : Response.json({ response: '```markdown\n**Respuesta**\n```' });
    },
    ...overrides,
  };
  return { calls, warnings, controller, options };
}

test('chat preserves authenticated request contracts, history limits and Markdown', async () => {
  const f = fixture();
  f.options.messages = Array.from({ length: 9 }, (_, i) => ({ role: 'user', content: ` ${i} ` }));
  f.options.candidateUsuarios = Array.from({ length: 120 }, (_, i) => `Player${i}`);
  assert.equal(await requestAssistantReply(f.options), '**Respuesta**');
  assert.equal(f.calls[0].body.history.length, 6);
  assert.equal(f.calls[0].body.history[0].content, '3');
  assert.equal(f.calls[0].body.candidateUsuarios.length, 100);
  assert.equal(f.calls[1].body.messages.length, 9);
  assert.equal('useReportesDb' in f.calls[1].body, false);
  for (const { init } of f.calls) {
    assert.equal(init.signal, f.controller.signal);
    assert.equal(init.credentials, 'include');
  }
});

test('report context carries only the scoped report contract', async () => {
  const f = fixture({
    buildContext: () => ({
      useReportesDb: true, reportQuery: { tool: 'get_report_detail' },
      reportesContext: { reportes: [{ id: 7 }], extra: 'not sent' },
    }),
  });
  await requestAssistantReply(f.options);
  assert.deepEqual(f.calls[1].body, {
    messages: [{ role: 'assistant', content: 'Hola' }, { role: 'user', content: 'Consulta' }],
    useReportesDb: true, reportQuery: { tool: 'get_report_detail' },
    reportesContext: { source: 'localStorage', reportes: [{ id: 7 }] },
  });
});

test('classifier failures use the existing local fallback with an explicit warning', async () => {
  for (const kind of ['network', 'html', 'array', 'unavailable']) {
    let observed;
    let chats = 0;
    const f = fixture({
      buildContext: (_, intent) => { observed = intent; return {}; },
      request: async endpoint => {
        if (endpoint === '/chat') { chats++; return Response.json({ text: 'Respuesta' }); }
        if (kind === 'network') throw new TypeError('offline');
        if (kind === 'html') return new Response('<!DOCTYPE html>');
        if (kind === 'array') return Response.json([]);
        return Response.json({ error: 'unavailable' }, { status: 503 });
      },
    });
    assert.equal(await requestAssistantReply(f.options), 'Respuesta');
    assert.equal(observed.tool, 'general_response');
    assert.equal(chats, 1);
    assert.equal(f.warnings.length, 1);
  }
});

test('expired session at either stage notifies once and never falls back', async () => {
  for (const stage of ['/intent', '/chat']) {
    let expired = 0;
    const endpoints = [];
    const f = fixture({
      onSessionExpired: () => expired++,
      request: async endpoint => {
        endpoints.push(endpoint);
        return endpoint === stage
          ? new Response('<!DOCTYPE html>', { status: 401 })
          : Response.json({ needsReportContext: false });
      },
    });
    await assert.rejects(requestAssistantReply(f.options), /sesión de Discord expiró/);
    assert.equal(expired, 1);
    assert.equal(f.warnings.length, 0);
    assert.deepEqual(endpoints, stage === '/intent' ? ['/intent'] : ['/intent', '/chat']);
  }
});

test('cancellation interrupts intent or chat without fallback or another request', async () => {
  for (const stage of ['/intent', '/chat']) {
    const endpoints = [];
    const f = fixture();
    f.options.request = async (endpoint, { signal }) => {
      endpoints.push(endpoint);
      if (endpoint !== stage) return Response.json({ needsReportContext: false });
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        f.controller.abort();
      });
    };
    await assert.rejects(requestAssistantReply(f.options), { name: 'AbortError' });
    assert.equal(f.warnings.length, 0);
    assert.deepEqual(endpoints, stage === '/intent' ? ['/intent'] : ['/intent', '/chat']);
  }
});

test('cancellation during parsing and an already cancelled request cannot reach chat', async () => {
  const f = fixture();
  f.options.request = async () => ({
    ok: true, status: 200,
    json: async () => { f.controller.abort(); return {}; },
  });
  await assert.rejects(requestAssistantReply(f.options), { name: 'AbortError' });
  f.options.request = async () => assert.fail('Cancelled request reached network');
  await assert.rejects(requestAssistantReply(f.options), { name: 'AbortError' });
  assert.equal(f.warnings.length, 0);
});

test('HTML, invalid or empty replies and application failures are explicit errors, never assistant success', async () => {
  const responses = [
    () => new Response('<!DOCTYPE html>'),
    () => Response.json([]),
    () => Response.json({}),
    () => Response.json({ response: ' ' }),
    () => Response.json({ response: '```markdown\n \n```' }),
    () => Response.json({ ok: false, error: 'Proveedor rechazado' }),
    () => Response.json({ error: 'Cuota agotada' }, { status: 429 }),
    () => new Response('<!DOCTYPE html>', { status: 502 }),
  ];
  for (const response of responses) {
    const f = fixture({
      request: async endpoint => endpoint === '/intent' ? Response.json({}) : response(),
    });
    await assert.rejects(requestAssistantReply(f.options), /JSON válido|formato|vacía|rechazado|Cuota agotada|502/);
  }
});

test('all supported reply fields preserve their priority and Markdown unwrapping', async () => {
  for (const payload of [{ response: 'reply', text: 'ignored' }, { text: 'reply' }, { output: 'reply' }, { message: { content: 'reply' } }]) {
    const f = fixture({
      request: async endpoint => Response.json(endpoint === '/intent' ? {} : payload),
    });
    assert.equal(await requestAssistantReply(f.options), 'reply');
  }
});
