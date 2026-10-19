import assert from 'node:assert/strict';
import { registerExpedientesRoutes } from './expedientes.routes.js';
import { requireSessionAuth } from '../../../shared/auth/sessionAuth.js';

let reportRoute;
const app = {
  get() {},
  post(path, ...handlers) {
    if (path === '/api/expedientes/report') reportRoute = handlers;
  },
};

registerExpedientesRoutes(app, {
  rateLimits: { general() {}, webhook() {} },
  requireBodyObject(_req, _res, next) { next(); },
});

assert.equal(reportRoute[1], requireSessionAuth, 'report creation must require Discord login');

let deniedStatus;
let deniedPayload;
let nextCalled = false;
requireSessionAuth(
  { body: { forwardToReportsApi: true } },
  {
    status(status) {
      deniedStatus = status;
      return this;
    },
    json(payload) {
      deniedPayload = payload;
    },
  },
  () => { nextCalled = true; },
);
assert.equal(deniedStatus, 401);
assert.equal(deniedPayload.code, 'auth_required');
assert.equal(nextCalled, false, 'unauthenticated requests must not reach the forwarding handler');

let authenticatedNextCalled = false;
requireSessionAuth(
  { session: { authUser: { id: 'discord-user' } } },
  { status() { throw new Error('authenticated user should not be rejected'); } },
  () => { authenticatedNextCalled = true; },
);
assert.equal(authenticatedNextCalled, true);

console.log('OK expediente report authentication checks completed');
