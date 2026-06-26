import crypto from 'node:crypto';
import { getSessionUser } from '../../../shared/auth/sessionAuth.js';

/**
 * Agrega parametros de query a una URL base de forma segura.
 */
function appendQueryParamsToUrl(baseUrl, params = {}) {
  try {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  } catch {
    const [pathOnly, existingQuery = ''] = String(baseUrl).split('?');
    const query = new URLSearchParams(existingQuery);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        query.set(key, String(value));
      }
    });
    const serialized = query.toString();
    return serialized ? `${pathOnly}?${serialized}` : pathOnly;
  }
}

/**
 * Redirige al frontend indicando autenticacion exitosa.
 */
function redirectAuthSuccess(res, successUrl) {
  return res.redirect(appendQueryParamsToUrl(successUrl, { auth: 'ok' }));
}

/**
 * Redirige al frontend indicando error de autenticacion y su motivo.
 */
function redirectAuthFailure(res, failureUrl, reason = 'login_failed') {
  return res.redirect(appendQueryParamsToUrl(failureUrl, { auth: 'error', reason }));
}

/**
 * Valida que la configuracion OAuth de Discord este completa.
 */
function ensureDiscordAuthConfig(config) {
  return Boolean(config.clientId && config.clientSecret && config.callbackUrl);
}

/**
 * Registra rutas de OAuth Discord y endpoints de sesion del usuario.
 */
export function registerAuthRoutes(app, deps) {
  const {
    discordAuth,
    authFrontendSuccessUrl,
    authFrontendFailureUrl,
    authAllowedDiscordUserIds,
  } = deps;

  app.get('/api/auth/discord', (req, res) => {
    return res.redirect('/auth/discord');
  });

  app.get('/auth/discord', (req, res) => {
    if (!ensureDiscordAuthConfig(discordAuth)) {
      return res.status(503).json({
        ok: false,
        error: 'Falta configuracion OAuth de Discord (CLIENT_ID, CLIENT_SECRET, CALLBACK_URL).',
      });
    }

    const state = crypto.randomBytes(24).toString('hex');
    req.session.discordOauthState = state;
    req.session.discordOauthStateAt = Date.now();

    const authorizeUrl = appendQueryParamsToUrl(`${discordAuth.apiUrl}/oauth2/authorize`, {
      client_id: discordAuth.clientId,
      redirect_uri: discordAuth.callbackUrl,
      response_type: 'code',
      scope: discordAuth.oauthScopes,
      state,
      prompt: 'consent',
    });

    return res.redirect(authorizeUrl);
  });

  app.get('/auth/discord/callback', async (req, res) => {
    const code = typeof req.query?.code === 'string' ? req.query.code.trim() : '';
    const state = typeof req.query?.state === 'string' ? req.query.state.trim() : '';
    const storedState = String(req.session?.discordOauthState || '');
    const storedStateAt = Number(req.session?.discordOauthStateAt || 0);

    delete req.session.discordOauthState;
    delete req.session.discordOauthStateAt;

    if (!code || !state || !storedState || state !== storedState) {
      return redirectAuthFailure(res, authFrontendFailureUrl, 'invalid_state');
    }

    if (!storedStateAt || Date.now() - storedStateAt > 10 * 60 * 1000) {
      return redirectAuthFailure(res, authFrontendFailureUrl, 'state_expired');
    }

    try {
      const tokenParams = new URLSearchParams({
        client_id: discordAuth.clientId,
        client_secret: discordAuth.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: discordAuth.callbackUrl,
        scope: discordAuth.oauthScopes,
      });

      const tokenResponse = await fetch(`${discordAuth.apiUrl}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams,
      });

      if (!tokenResponse.ok) {
        return redirectAuthFailure(res, authFrontendFailureUrl, `token_${tokenResponse.status}`);
      }

      const tokenPayload = await tokenResponse.json();
      const accessToken = String(tokenPayload?.access_token || '').trim();
      if (!accessToken) {
        return redirectAuthFailure(res, authFrontendFailureUrl, 'missing_access_token');
      }

      const meResponse = await fetch(`${discordAuth.apiUrl}/users/@me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!meResponse.ok) {
        return redirectAuthFailure(res, authFrontendFailureUrl, `profile_${meResponse.status}`);
      }

      const me = await meResponse.json();
      const discordUserId = String(me?.id || '').trim();
      if (!discordUserId) {
        return redirectAuthFailure(res, authFrontendFailureUrl, 'missing_user_id');
      }

      if (authAllowedDiscordUserIds.size > 0 && !authAllowedDiscordUserIds.has(discordUserId)) {
        return redirectAuthFailure(res, authFrontendFailureUrl, 'not_allowed');
      }

      req.session.authUser = {
        id: discordUserId,
        username: String(me?.username || ''),
        globalName: String(me?.global_name || ''),
        discriminator: String(me?.discriminator || ''),
        avatar: String(me?.avatar || ''),
        email: String(me?.email || ''),
        verified: Boolean(me?.verified),
        premiumType: Number(me?.premium_type || 0),
        loggedAt: new Date().toISOString(),
      };

      return req.session.save(() => redirectAuthSuccess(res, authFrontendSuccessUrl));
    } catch (error) {
      console.error('[auth] Discord callback error', error);
      return redirectAuthFailure(res, authFrontendFailureUrl, 'exception');
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    if (!user) {
      return res.status(401).json({ authenticated: false, user: null });
    }

    return res.status(200).json({ authenticated: true, user });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('mw.sid');
      return res.status(200).json({ ok: true });
    });
  });
}
