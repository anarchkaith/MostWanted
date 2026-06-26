import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app/createApp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const port = Number(process.env.PORT || 8787);
const isProduction = process.env.NODE_ENV === 'production';

const { app, diagnostics } = createApp({ rootDir, isProduction });

const server = app.listen(port, () => {
  console.log(`Most Wanted server listening on http://localhost:${port}`);
  console.log('[hexbot] Integration configuration', {
    enabled: Boolean(diagnostics.hexbotConfig.baseUrl && diagnostics.hexbotConfig.apiSecret),
    baseUrl: diagnostics.hexbotConfig.baseUrl || '(missing)',
    timeoutMs: diagnostics.hexbotConfig.timeoutMs,
  });
  console.log('[wordpress] Integration configuration', {
    enabled: Boolean(diagnostics.wordpressReportsConfig.enabled),
    baseUrl: diagnostics.wordpressReportsConfig.baseUrl || '(missing)',
    hasSecret: Boolean(diagnostics.wordpressReportsConfig.apiSecret),
    timeoutMs: diagnostics.wordpressReportsConfig.timeoutMs,
  });
});

server.requestTimeout = 130 * 1000;
server.headersTimeout = 135 * 1000;
server.keepAliveTimeout = 70 * 1000;

server.on('clientError', (error, socket) => {
  if (error.code === 'ECONNRESET' || !socket.writable) return;
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
