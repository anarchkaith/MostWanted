import assert from 'node:assert/strict';
import test from 'node:test';
import { handleInternalLink, isSearchLanding, navigateApp, readAppRoute } from './appNavigation.js';

test('centered search is only the home screen without a selected player', () => {
  for (const player of [null, undefined, {}, { nickname: '', rid: '' }]) {
    assert.equal(isSearchLanding('/', player), true);
  }
  for (const player of [{ nickname: 'Player' }, { rid: '123' }]) {
    assert.equal(isSearchLanding('/', player), false);
  }
  for (const path of ['/perfil', '/denunciar', '/jugador/Player', '/jugador/123', '/usuario/Player', '/reporte/42', '/expediente/17']) {
    assert.equal(isSearchLanding(path, null), false, path);
  }
});

test('route parsing preserves public report, expediente, player, profile and callback paths', () => {
  for (const path of ['/', '/denunciar', '/perfil', '/usuario/Player', '/jugador/123', '/jugador/Player%20Name']) {
    assert.equal(readAppRoute(path).isValidPath, true, path);
  }
  assert.equal(readAppRoute('/reporte/42').reportId, 42);
  assert.equal(readAppRoute('/expediente/17').expedienteId, 17);
  assert.equal(readAppRoute('/reporte/42').expedienteId, null);
  assert.equal(readAppRoute('/auth-callback').isAuthCallback, true);
  for (const path of ['/missing', '/reporte/abc', '/expediente/-1', '/jugador/', '/jugador/a/b']) {
    assert.equal(readAppRoute(path).isValidPath, false, path);
  }
});

test('navigation preserves query flags and scrolls only when entering or leaving the report screen', () => {
  const calls = [];
  const browser = {
    location: { pathname: '/', search: '?demo=true' },
    history: {
      pushState: (...args) => calls.push(['push', ...args]),
      replaceState: (...args) => calls.push(['replace', ...args]),
    },
    scrollTo: (...args) => calls.push(['scroll', ...args]),
  };
  navigateApp(browser, '/perfil');
  assert.deepEqual(calls, [['push', {}, '', '/perfil?demo=true']]);
  calls.length = 0;
  navigateApp(browser, '/denunciar', true);
  assert.deepEqual(calls, [['replace', {}, '', '/denunciar?demo=true'], ['scroll', 0, 0]]);
  calls.length = 0;
  browser.location.pathname = '/denunciar';
  navigateApp(browser, '/jugador/123');
  assert.deepEqual(calls, [['push', {}, '', '/jugador/123?demo=true'], ['scroll', 0, 0]]);
});

test('internal links intercept only unmodified left clicks', () => {
  for (const modifiers of [{ button: 1 }, { button: 2 }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }]) {
    const event = { button: 0, preventDefault() { assert.fail('Browser navigation must be preserved'); }, ...modifiers };
    handleInternalLink(event, () => assert.fail('SPA navigation must not run'), '/perfil');
  }
  let prevented = false;
  let destination = '';
  handleInternalLink({ button: 0, preventDefault() { prevented = true; } }, path => { destination = path; }, '/perfil');
  assert.equal(prevented, true);
  assert.equal(destination, '/perfil');
});
