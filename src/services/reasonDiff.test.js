import assert from 'node:assert/strict';
import { diffWords } from './reasonDiff.js';

const segments = diffWords('me crasheo el juego', 'Me crasheó el juego.');
assert.deepEqual(segments.filter(s => s.type === 'removed').map(s => s.text), ['me', 'crasheo', 'juego']);
assert.deepEqual(segments.filter(s => s.type === 'added').map(s => s.text), ['Me', 'crasheó', 'juego.']);
assert.equal(segments.map(s => s.type === 'removed' ? '' : s.text).join(''), 'Me crasheó el juego.', 'same and added text rebuild the improved text');

const identical = diffWords('hola mundo', 'hola mundo');
assert.deepEqual(identical, [{ type: 'same', text: 'hola mundo' }]);

assert.deepEqual(diffWords('', 'nuevo'), [{ type: 'added', text: 'nuevo' }]);

console.log('OK reason diff');
