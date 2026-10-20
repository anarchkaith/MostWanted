import { getSessionUser } from './sessionAuth.js';

export class StaffAuthError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function createDiscordStaffVerifier({ discordAuth, guildId, roleIds, fetchImpl = fetch }) {
  const refreshes = new Map();
  let retryAfter = 0;
  async function request(url, options) {
    if (Date.now() < retryAfter) throw new StaffAuthError(503, 'discord_rate_limited');
    let response;
    try {
      response = await fetchImpl(url, { ...options, signal: AbortSignal.timeout(9000) });
    } catch {
      throw new StaffAuthError(503, 'discord_unavailable');
    }
    if (response.status === 429) {
      retryAfter = Date.now() + Math.max(1000, Math.min(300000, (Number(response.headers?.get('retry-after')) || 1) * 1000));
      throw new StaffAuthError(503, 'discord_rate_limited');
    }
    return response;
  }
  return async function verifyStaff(req) {
    if (!getSessionUser(req)?.id) throw new StaffAuthError(401, 'auth_required');
    if (!guildId || !roleIds?.size) throw new StaffAuthError(503, 'staff_roles_not_configured');
    let token = req.session.discordToken;
    if (!token?.accessToken || !String(token.scope || '').split(/\s+/).includes('guilds.members.read')) {
      throw new StaffAuthError(401, 'discord_reauthorization_required');
    }
    if (!Number.isFinite(token.expiresAt) || token.expiresAt <= Date.now() + 30000) {
      if (!token.refreshToken) throw new StaffAuthError(401, 'discord_session_expired');
      const key = req.sessionID || getSessionUser(req).id;
      let refresh = refreshes.get(key);
      if (!refresh) {
        refresh = (async () => {
          const response = await request(`${discordAuth.apiUrl}/oauth2/token`, {
            method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ client_id: discordAuth.clientId, client_secret: discordAuth.clientSecret,
              grant_type: 'refresh_token', refresh_token: token.refreshToken }),
          });
          if (response.status === 400 || response.status === 401) throw new StaffAuthError(401, 'discord_session_expired');
          if (!response.ok) throw new StaffAuthError(503, 'discord_unavailable');
          const payload = await response.json();
          if (!payload.access_token || !(Number(payload.expires_in) > 0)) throw new StaffAuthError(503, 'discord_invalid_response');
          return { accessToken: payload.access_token, refreshToken: payload.refresh_token || token.refreshToken,
            scope: payload.scope || token.scope, expiresAt: Date.now() + Number(payload.expires_in) * 1000 };
        })();
        refreshes.set(key, refresh);
        refresh.finally(() => refreshes.delete(key)).catch(() => {});
      }
      try {
        token = await refresh;
        req.session.discordToken = token;
        await new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
      } catch (error) {
        if (error.status === 401) delete req.session.discordToken;
        throw error instanceof StaffAuthError ? error : new StaffAuthError(503, 'discord_unavailable');
      }
    }
    if (!String(token.scope).split(/\s+/).includes('guilds.members.read')) throw new StaffAuthError(401, 'discord_reauthorization_required');
    const response = await request(`${discordAuth.apiUrl}/users/@me/guilds/${encodeURIComponent(guildId)}/member`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    if (response.status === 401) throw new StaffAuthError(401, 'discord_reauthorization_required');
    if (response.status === 403 || response.status === 404) throw new StaffAuthError(403, 'staff_role_required');
    if (!response.ok) throw new StaffAuthError(503, 'discord_unavailable');
    let member;
    try { member = await response.json(); } catch { throw new StaffAuthError(503, 'discord_invalid_response'); }
    if (!Array.isArray(member.roles)) throw new StaffAuthError(503, 'discord_invalid_response');
    if (!member.roles.some((role) => roleIds.has(String(role)))) throw new StaffAuthError(403, 'staff_role_required');
    return { manageCases: true };
  };
}

export function createRequireCaseStaff(verifyStaff) {
  return async (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      req.caseCapabilities = await verifyStaff(req);
      return next();
    } catch (error) {
      return res.status(error.status || 503).json({ ok: false, error: error.code || 'discord_unavailable',
        code: error.code || 'discord_unavailable', capabilities: { manageCases: false } });
    }
  };
}
