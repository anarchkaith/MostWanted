import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import session from 'express-session';
import { createAiConfig } from '../ai/config.js';
import { createWordpressReportsConfig } from '../reports/wordpressConfig.js';
import { buildPlayerInsightsWithScCache, getReportesSnapshot } from '../reportes/store.js';
import { RATE_LIMITS } from '../middleware/rateLimiter.js';
import { mapUpstreamError, requireObjectBody } from '../middleware/requestValidation.js';
import { createMaybeRequireSessionAuth } from '../shared/auth/sessionAuth.js';
import { createDiscordStaffVerifier } from '../shared/auth/discordStaff.js';
import { createCaseReportsSource } from '../modules/expedientes/services/caseReports.service.js';
import { createCaseSummaryGenerator } from '../modules/expedientes/services/caseSummary.service.js';
import { readCase } from '../modules/expedientes/services/cases.service.js';
import { registerRoutes } from './registerRoutes.js';

function readWebhookAllowedOrigins() {
  const raw = String(process.env.WEBHOOK_ALLOWED_ORIGINS || '').trim();
  if (!raw) {
    return new Set([
      'https://mostwanted.kaithsrebels.com',
      'https://www.mostwanted.kaithsrebels.com',
    ]);
  }

  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

/**
 * Construye y configura la instancia principal de Express del backend.
 * Centraliza middleware global, configuraciones derivadas de entorno
 * y el registro de rutas por modulo.
 */
export function createApp({ rootDir, isProduction }) {
  const app = express();

  const aiConfig = createAiConfig(process.env);
  const wordpressReportsConfig = createWordpressReportsConfig(process.env);

  const debugMode = process.env.DEBUG_MODE === 'true';
  const discordAuth = {
    clientId: String(process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID || '1538725229428351127').trim(),
    clientSecret: String(process.env.CLIENT_SECRET || process.env.DISCORD_CLIENT_SECRET || '').trim(),
    callbackUrl: String(
      process.env.CALLBACK_URL ||
      process.env.DISCORD_REDIRECT_URI ||
      'http://localhost:5000/auth/discord/callback',
    ).trim(),
    apiUrl: String(process.env.DISCORD_API_URL || 'https://discord.com/api/v10').trim().replace(/\/+$/, ''),
    oauthScopes: [...new Set(`${process.env.DISCORD_OAUTH_SCOPES || 'identify email'} guilds.members.read`.trim().split(/\s+/))].join(' '),
  };

  const authRequireLogin = process.env.AUTH_REQUIRE_LOGIN !== 'false';
  const verifyCaseStaff = createDiscordStaffVerifier({
    discordAuth,
    guildId: String(process.env.DISCORD_STAFF_GUILD_ID || '').trim(),
    roleIds: new Set(String(process.env.DISCORD_STAFF_ROLE_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)),
  });
  const getCaseReports = createCaseReportsSource({ config: wordpressReportsConfig });
  const generateCaseSummary = createCaseSummaryGenerator({ config: aiConfig });
  const refreshPlayerCase = async ({ nickname, rid, reportId }) => {
    const result = await readCase({ rootDir, source: getCaseReports, generateCaseSummary, nickname, rid });
    if (!result.payload.ok || result.payload.source.stale) throw new Error('case_reports_refresh_failed');
    if (!result.payload.case || (reportId != null && !result.payload.case.reportIds.some((id) => String(id) === String(reportId)))) {
      throw new Error('new_report_not_available_for_summary');
    }
    if (result.payload.case?.classification?.error) throw new Error('case_summary_refresh_failed');
  };
  const authAllowedDiscordUserIds = new Set(
    String(process.env.AUTH_ALLOWED_DISCORD_USER_IDS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );

  const authFrontendSuccessUrl = String(
    process.env.AUTH_FRONTEND_SUCCESS_URL ||
    process.env.VITE_DISCORD_REDIRECT_URI ||
    'http://localhost:5180/auth-callback',
  ).trim();

  const authFrontendFailureUrl = String(
    process.env.AUTH_FRONTEND_FAILURE_URL || authFrontendSuccessUrl,
  ).trim();

  const webhookAllowedOrigins = readWebhookAllowedOrigins();
  const webhookMinIntervalMs = Number(process.env.DISCORD_WEBHOOK_MIN_INTERVAL_MS || 45000);
  const webhookLastSubmissionByIp = new Map();
  const discordWebhookUrl = String(process.env.DISCORD_WEBHOOK_URL || '').trim();

  const distDir = path.join(rootDir, 'dist');

  app.set('trust proxy', 1);
  app.use('/api', cors({
    origin: (origin, callback) => callback(null, !origin || webhookAllowedOrigins.has(origin)),
    credentials: true,
  }));
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

  const requireNonEmptyBody = requireObjectBody({
    allowEmpty: false,
    message: 'El cuerpo de la peticion esta vacio.',
  });

  const requireBodyObject = requireObjectBody({
    allowEmpty: true,
    message: 'El cuerpo de la peticion es invalido.',
  });

  const maybeRequireSessionAuth = createMaybeRequireSessionAuth({
    authRequireLogin,
  });

  registerRoutes(app, {
    rootDir,
    aiConfig,
    wordpressReportsConfig,
    debugMode,
    discordAuth,
    verifyCaseStaff,
    getCaseReports,
    generateCaseSummary,
    refreshPlayerCase,
    authFrontendSuccessUrl,
    authFrontendFailureUrl,
    authAllowedDiscordUserIds,
    webhookAllowedOrigins,
    webhookMinIntervalMs,
    webhookLastSubmissionByIp,
    discordWebhookUrl,
    rateLimits: RATE_LIMITS,
    requireNonEmptyBody,
    requireBodyObject,
    maybeRequireSessionAuth,
    mapUpstreamError,
    getReportesSnapshot,
    buildPlayerInsightsWithScCache,
  });

  if (isProduction && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return {
    app,
    diagnostics: {
      wordpressReportsConfig,
    },
  };
}
