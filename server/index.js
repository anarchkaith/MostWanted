import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import session from 'express-session';
import { createAiConfig } from './ai/config.js';
import { hasAiProvider } from './ai/client.js';
import { executeChatUseCase } from './ai/usecases/chat.js';
import { executeIntentUseCase } from './ai/usecases/intent.js';
import { executeReportCorrelationUseCase } from './ai/usecases/reportCorrelation.js';
import { createHexbotConfig } from './reports/config.js';
import { buildPlayerInsightsWithScCache, getReportesSnapshot } from './reportes/store.js';
import { checkHexbotIntegration, sendReportToHexbot } from './reports/service.js';
import { createWordpressReportsConfig } from './reports/wordpressConfig.js';
import { checkWordpressIntegration, sendReportToWordpress } from './reports/wordpressService.js';
import { sendReportToDiscordWebhook } from './reports/discord.js';
import { validateIncomingReportSubmission } from './reports/validation.js';
import { RATE_LIMITS } from './middleware/rateLimiter.js';
import { mapUpstreamError, requireObjectBody } from './middleware/requestValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

dotenv.config({ path: path.join(rootDir, '.env') });

const app = express();
const port = Number(process.env.PORT || 8787);
const isProduction = process.env.NODE_ENV === 'production';
const aiConfig = createAiConfig(process.env);
const hexbotConfig = createHexbotConfig(process.env);
const wordpressReportsConfig = createWordpressReportsConfig(process.env);

const DEBUG_MODE = process.env.DEBUG_MODE === 'true';
const DISCORD_CLIENT_ID = String(process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '').trim();
const DISCORD_CLIENT_SECRET = String(process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '').trim();
const DISCORD_CALLBACK_URL = String(process.env.CALLBACK_URL || process.env.DISCORD_REDIRECT_URI || '').trim();
const DISCORD_API_URL = String(process.env.DISCORD_API_URL || 'https://discord.com/api/v10').trim().replace(/\/+$/, '');
const DISCORD_OAUTH_SCOPES = String(process.env.DISCORD_OAUTH_SCOPES || 'identify email').trim();
const AUTH_REQUIRE_LOGIN_FOR_REPORTS = process.env.AUTH_REQUIRE_LOGIN_FOR_REPORTS === 'true';
const AUTH_ALLOWED_DISCORD_USER_IDS = new Set(
    String(process.env.AUTH_ALLOWED_DISCORD_USER_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
);
const AUTH_FRONTEND_SUCCESS_URL = String(
    process.env.AUTH_FRONTEND_SUCCESS_URL ||
    process.env.VITE_DISCORD_REDIRECT_URI ||
    'http://localhost:5180/auth-callback',
).trim();
const AUTH_FRONTEND_FAILURE_URL = String(
    process.env.AUTH_FRONTEND_FAILURE_URL || AUTH_FRONTEND_SUCCESS_URL,
).trim();

const WEBHOOK_ALLOWED_ORIGINS = new Set([
    'https://mostwanted.kaithsrebels.com',
    'https://www.mostwanted.kaithsrebels.com',
]);
const WEBHOOK_MIN_INTERVAL_MS = Number(process.env.DISCORD_WEBHOOK_MIN_INTERVAL_MS || 45000);
const webhookLastSubmissionByIp = new Map();

app.set('trust proxy', 1);
app.use(session({
    name: 'mw.sid',
    secret: String(process.env.SESSION_SECRET || 'mostwanted-dev-session-secret-change-me'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
}));
app.use(express.json({ limit: '1mb' }));

// --- Helpers ---

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

function getSessionUser(req) {
    const user = req?.session?.authUser;
    return user && typeof user === 'object' ? user : null;
}

function redirectAuthSuccess(res) {
    return res.redirect(appendQueryParamsToUrl(AUTH_FRONTEND_SUCCESS_URL, { auth: 'ok' }));
}

function redirectAuthFailure(res, reason = 'login_failed') {
    return res.redirect(appendQueryParamsToUrl(AUTH_FRONTEND_FAILURE_URL, { auth: 'error', reason }));
}

function ensureDiscordAuthConfig() {
    return Boolean(DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET && DISCORD_CALLBACK_URL);
}

function maybeRequireAuthForReports(req, res, next) {
    if (!AUTH_REQUIRE_LOGIN_FOR_REPORTS) {
        return next();
    }
    if (!getSessionUser(req)) {
        return res.status(401).json({
            ok: false,
            error: 'Debes iniciar sesion con Discord para enviar reportes.',
            code: 'auth_required',
        });
    }
    return next();
}

function resolveClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
    }
    return req.socket?.remoteAddress || req.ip || 'unknown';
}

function isAllowedWebhookOrigin(req) {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    return Boolean(origin && WEBHOOK_ALLOWED_ORIGINS.has(origin));
}

function safeStr(value, maxLen, fallback = '') {
    const text = typeof value === 'string' ? value.trim() : fallback;
    return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

function sanitizeDiscordPayload(body) {
    const content = safeStr(body?.content, 2000);
    const embeds = Array.isArray(body?.embeds)
        ? body.embeds.slice(0, 10).map((embed) => {
            const fields = Array.isArray(embed?.fields)
                ? embed.fields
                    .slice(0, 25)
                    .map((f) => ({
                        name: safeStr(f?.name, 256),
                        value: safeStr(f?.value, 1024),
                        inline: typeof f?.inline === 'boolean' ? f.inline : false,
                    }))
                    .filter((f) => f.name && f.value)
                : undefined;
            return {
                ...(embed?.title ? { title: safeStr(embed.title, 256) } : {}),
                ...(embed?.description ? { description: safeStr(embed.description, 4096) } : {}),
                ...(typeof embed?.color === 'number' ? { color: Math.floor(embed.color) & 0xffffff } : {}),
                ...(embed?.timestamp ? { timestamp: safeStr(embed.timestamp, 128) } : {}),
                ...(fields?.length ? { fields } : {}),
            };
        }).filter((e) => e.title || e.description || e.fields)
        : undefined;
    return { content, embeds };
}

async function fetchBattleyeStatus() {
    const response = await fetch('https://battleye.dudx.info/verify/banLookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            challenge: 'c155a4874f79aef14495ed6f008ab3e2086075b4056fa6ba029d41996bfa6c21',
            difficulty: 1000000,
            salt: '5ZOjeTvJTsXTdDR7ztrk',
        }),
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

    return { ok: response.ok, status: response.status, payload };
}

// --- Middleware instances ---

const requireNonEmptyBody = requireObjectBody({
    allowEmpty: false,
    message: 'El cuerpo de la peticion esta vacio.',
});

const requireBodyObject = requireObjectBody({
    allowEmpty: true,
    message: 'El cuerpo de la peticion es invalido.',
});

function ensureAiProvider(req, res, next) {
    if (!hasAiProvider(aiConfig)) {
        return res.status(500).json({
            error: 'No hay proveedores IA configurados. Activa Ollama local o credenciales de produccion.',
        });
    }
    return next();
}

function withAiErrorHandler(handler, timeoutMsg, fallbackMsg) {
    return async function (req, res) {
        try {
            return await handler(req, res);
        } catch (error) {
            const mapped = mapUpstreamError(error, timeoutMsg, fallbackMsg);
            return res.status(mapped.status).json(mapped.payload);
        }
    };
}

// --- Routes ---

app.get('/api/auth/discord', (req, res) => {
    return res.redirect('/auth/discord');
});

app.get('/auth/discord', (req, res) => {
    if (!ensureDiscordAuthConfig()) {
        return res.status(503).json({
            ok: false,
            error: 'Falta configuracion OAuth de Discord (CLIENT_ID, CLIENT_SECRET, CALLBACK_URL).',
        });
    }

    const state = crypto.randomBytes(24).toString('hex');
    req.session.discordOauthState = state;
    req.session.discordOauthStateAt = Date.now();

    const authorizeUrl = appendQueryParamsToUrl(`${DISCORD_API_URL}/oauth2/authorize`, {
        client_id: DISCORD_CLIENT_ID,
        redirect_uri: DISCORD_CALLBACK_URL,
        response_type: 'code',
        scope: DISCORD_OAUTH_SCOPES,
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
        return redirectAuthFailure(res, 'invalid_state');
    }

    if (!storedStateAt || Date.now() - storedStateAt > 10 * 60 * 1000) {
        return redirectAuthFailure(res, 'state_expired');
    }

    try {
        const tokenParams = new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: DISCORD_CALLBACK_URL,
            scope: DISCORD_OAUTH_SCOPES,
        });

        const tokenResponse = await fetch(`${DISCORD_API_URL}/oauth2/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenParams,
        });

        if (!tokenResponse.ok) {
            return redirectAuthFailure(res, `token_${tokenResponse.status}`);
        }

        const tokenPayload = await tokenResponse.json();
        const accessToken = String(tokenPayload?.access_token || '').trim();
        if (!accessToken) {
            return redirectAuthFailure(res, 'missing_access_token');
        }

        const meResponse = await fetch(`${DISCORD_API_URL}/users/@me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!meResponse.ok) {
            return redirectAuthFailure(res, `profile_${meResponse.status}`);
        }

        const me = await meResponse.json();
        const discordUserId = String(me?.id || '').trim();
        if (!discordUserId) {
            return redirectAuthFailure(res, 'missing_user_id');
        }

        if (AUTH_ALLOWED_DISCORD_USER_IDS.size > 0 && !AUTH_ALLOWED_DISCORD_USER_IDS.has(discordUserId)) {
            return redirectAuthFailure(res, 'not_allowed');
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

        return req.session.save(() => redirectAuthSuccess(res));
    } catch (error) {
        console.error('[auth] Discord callback error', error);
        return redirectAuthFailure(res, 'exception');
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

app.post('/api/ia-chat', RATE_LIMITS.ai, ensureAiProvider, requireNonEmptyBody, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeChatUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
        return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
}, 'El chat IA no respondio a tiempo.', 'No se pudo conectar con la API IA.'));

app.post('/api/ia-intent', RATE_LIMITS.intent, requireBodyObject, withAiErrorHandler(async (req, res) => {
    const result = await executeIntentUseCase({ config: aiConfig, body: req.body });
    if (!result.ok) {
        return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
}, 'El clasificador de intencion no respondio a tiempo.', 'No se pudo clasificar la consulta.'));

app.post('/api/ia-report-correlation', RATE_LIMITS.ai, ensureAiProvider, requireNonEmptyBody, withAiErrorHandler(async (req, res) => {
    const reportes = getReportesSnapshot(rootDir);
    const result = await executeReportCorrelationUseCase({ config: aiConfig, body: req.body, reportes });
    if (!result.ok) {
        return res.status(result.status).json({ error: result.error, details: result.details });
    }
    return res.status(result.status).json(result.payload);
}, 'La correlacion IA no respondio a tiempo.', 'No se pudo correlacionar el reporte.'));

app.get('/api/reports/health', RATE_LIMITS.webhook, async (req, res) => {
    if (wordpressReportsConfig.enabled) {
        const result = await checkWordpressIntegration({
            config: wordpressReportsConfig,
            logger: console,
        });

        if (result.ok) {
            return res.status(200).json({
                ok: true,
                configured: true,
                destination: 'wordpress',
                upstream: {
                    status: result.status,
                    payload: result.payload,
                },
            });
        }

        const status = result.errorCode === 'integration_not_configured' ? 503 : 502;
        const configured = result.errorCode !== 'integration_not_configured';

        return res.status(status).json({
            ok: false,
            configured,
            destination: 'wordpress',
            error: result.message,
            details: result.details,
            upstreamStatus: result.status,
        });
    }

    const result = await checkHexbotIntegration({
        config: hexbotConfig,
        logger: console,
    });

    if (result.ok) {
        return res.status(200).json({
            ok: true,
            configured: true,
            destination: 'hexbot',
            upstream: {
                status: result.status,
                payload: result.payload,
            },
        });
    }

    const status = result.errorCode === 'integration_not_configured' ? 503 : 502;
    const configured = result.errorCode !== 'integration_not_configured';

    return res.status(status).json({
        ok: false,
        configured,
        destination: 'hexbot',
        error: result.message,
        details: result.details,
        upstreamStatus: result.status,
    });
});

app.post('/api/reports', RATE_LIMITS.webhook, maybeRequireAuthForReports, requireNonEmptyBody, async (req, res) => {
    const validation = validateIncomingReportSubmission(req.body);

    if (!validation.ok) {
        return res.status(validation.status).json({ ok: false, error: validation.error });
    }

    if (wordpressReportsConfig.enabled) {
        const [discordDelivery, wordpressResult] = await Promise.all([
            sendReportToDiscordWebhook(validation.value),
            sendReportToWordpress({
                config: wordpressReportsConfig,
                submission: validation.value,
                logger: console,
            }),
        ]);

        if (discordDelivery.ok || wordpressResult.delivery.ok) {
            return res.status(201).json({
                ok: true,
                destination: 'wordpress',
                reportId: wordpressResult.delivery.reportId ?? null,
                playerPostId: wordpressResult.delivery.playerPostId ?? null,
                player: wordpressResult.delivery.player ?? null,
                evidenceCount: Array.isArray(wordpressResult.payload?.evidence) ? wordpressResult.payload.evidence.length : 0,
                discordDelivery,
                wordpressDelivery: wordpressResult.delivery,
                botDelivery: wordpressResult.delivery,
            });
        }

        return res.status(202).json({
            ok: true,
            destination: 'wordpress',
            reportId: null,
            playerPostId: null,
            evidenceCount: Array.isArray(wordpressResult.payload?.evidence) ? wordpressResult.payload.evidence.length : 0,
            discordDelivery,
            wordpressDelivery: wordpressResult.delivery,
            botDelivery: wordpressResult.delivery,
            warning: 'El reporte fue aceptado por la web, pero no se pudo confirmar el envio a WordPress y/o Discord.',
        });
    }

    const [discordDelivery, hexbotResult] = await Promise.all([
        sendReportToDiscordWebhook(validation.value),
        sendReportToHexbot({
            config: hexbotConfig,
            submission: validation.value,
            logger: console,
        }),
    ]);

    if (discordDelivery.ok || hexbotResult.delivery.ok) {
        return res.status(201).json({
            ok: true,
            reportId: hexbotResult.delivery.reportId ?? null,
            evidenceCount: Array.isArray(hexbotResult.payload?.evidence) ? hexbotResult.payload.evidence.length : 0,
            discordDelivery,
            hexbotDelivery: hexbotResult.delivery,
            botDelivery: hexbotResult.delivery,
        });
    }

    return res.status(202).json({
        ok: true,
        reportId: null,
        evidenceCount: Array.isArray(hexbotResult.payload?.evidence) ? hexbotResult.payload.evidence.length : 0,
        discordDelivery,
        hexbotDelivery: hexbotResult.delivery,
        botDelivery: hexbotResult.delivery,
        warning: 'El reporte fue aceptado por la web, pero no se pudo confirmar el envio a todos los destinos configurados.',
    });
});

app.get('/api/reports/player-insights', RATE_LIMITS.general, async (req, res) => {
    const username = typeof req.query?.username === 'string' ? req.query.username.trim() : '';
    const rid = typeof req.query?.rid === 'string' ? req.query.rid.trim() : '';

    if (!username && !rid) {
        return res.status(400).json({
            ok: false,
            error: 'Debes enviar username o rid para consultar antecedentes del jugador.',
        });
    }

    const reportes = getReportesSnapshot(rootDir);
    const player = await buildPlayerInsightsWithScCache(reportes, { username, rid });

    return res.status(200).json({ ok: true, player });
});

app.get('/api/battleye-status', RATE_LIMITS.general, async (req, res) => {
    try {
        const result = await fetchBattleyeStatus();
        return res.status(result.ok ? 200 : result.status || 502).json(result.payload);
    } catch (error) {
        return res.status(502).json({
            message: 'No se pudo consultar Battleye.',
            detail: error instanceof Error ? error.message : 'fallo desconocido',
        });
    }
});

app.post('/api/discord-webhook', RATE_LIMITS.webhook, maybeRequireAuthForReports, async (req, res) => {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const clientIp = resolveClientIp(req);
    const now = Date.now();

    if (!webhookUrl) {
        return res.status(503).json({ error: 'Webhook de Discord no configurado en el servidor.' });
    }

    if (!isAllowedWebhookOrigin(req)) {
        return res.status(403).json({ error: 'Origen no autorizado para este endpoint.' });
    }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        return res.status(415).json({ error: 'Tipo de contenido no soportado. Usa application/json.' });
    }

    if (!DEBUG_MODE) {
        const elapsed = now - (webhookLastSubmissionByIp.get(clientIp) || 0);
        if (elapsed < WEBHOOK_MIN_INTERVAL_MS) {
            const retryAfterSeconds = Math.ceil((WEBHOOK_MIN_INTERVAL_MS - elapsed) / 1000);
            res.set('Retry-After', String(retryAfterSeconds));
            return res.status(429).json({
                error: `Debes esperar ${retryAfterSeconds}s antes de enviar otro reporte.`,
                retryAfterSeconds,
            });
        }
    }

    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'El cuerpo de la peticion esta vacio.' });
    }

    try {
        const safePayload = sanitizeDiscordPayload(req.body);

        if (!safePayload.content && (!Array.isArray(safePayload.embeds) || safePayload.embeds.length === 0)) {
            return res.status(400).json({ error: 'El payload no contiene contenido ni embeds validos.' });
        }

        const discordRes = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(safePayload),
        });

        if (!discordRes.ok) {
            const detail = await discordRes.text().catch(() => '');
            return res.status(discordRes.status).json({
                error: 'Discord rechazo el webhook.',
                details: detail.slice(0, 200),
            });
        }

        if (!DEBUG_MODE) {
            webhookLastSubmissionByIp.set(clientIp, now);
        }
        return res.status(204).end();
    } catch (error) {
        return res.status(502).json({
            error: 'No se pudo contactar con Discord.',
            details: error instanceof Error ? error.message : 'fallo desconocido',
        });
    }
});

if (isProduction && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
    });
}

const server = app.listen(port, () => {
    console.log(`Most Wanted server listening on http://localhost:${port}`);
    console.log('[hexbot] Integration configuration', {
        enabled: Boolean(hexbotConfig.baseUrl && hexbotConfig.apiSecret),
        baseUrl: hexbotConfig.baseUrl || '(missing)',
        timeoutMs: hexbotConfig.timeoutMs,
    });
    console.log('[wordpress] Integration configuration', {
        enabled: Boolean(wordpressReportsConfig.enabled),
        baseUrl: wordpressReportsConfig.baseUrl || '(missing)',
        hasSecret: Boolean(wordpressReportsConfig.apiSecret),
        timeoutMs: wordpressReportsConfig.timeoutMs,
    });
});

server.requestTimeout = 130 * 1000;
server.headersTimeout = 135 * 1000;
server.keepAliveTimeout = 70 * 1000;

server.on('clientError', (error, socket) => {
    if (error.code === 'ECONNRESET' || !socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
