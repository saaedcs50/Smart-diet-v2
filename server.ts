import dotenv from 'dotenv';
dotenv.config(); // Host-provided environment variables always take precedence.

import express from 'express';
import path from 'path';
import { createApiApp } from './src/server/createApiApp';
import { validateSecurityConfig } from './src/server/api';
import { BRAND } from './src/config/brand';

function readPort(): number {
  const raw = process.env.PORT?.trim();
  if (!raw) return 3000;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return value;
}

function readTrustProxyHops(): number {
  const raw = process.env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return 0;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error('TRUST_PROXY_HOPS must be a non-negative integer.');
  }
  return value;
}

const PORT = readPort();
const HOST = process.env.HOST?.trim() || '0.0.0.0';
const app = createApiApp({ trustProxyHops: readTrustProxyHops() });

let closeVite: (() => Promise<void>) | undefined;
let httpServer: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;

async function start() {
  // يوقف السيرفر فورًا قبل استقبال أي طلب لو إعدادات الأمان ناقصة في الإنتاج.
  validateSecurityConfig();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    closeVite = () => vite.close();
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer = app.listen(PORT, HOST, () => {
    console.log(`${BRAND.appName} Server listening on ${HOST}:${PORT}`);
  });

  httpServer.on('error', (error: Error) => {
    console.error(`Server listener failed: ${error.message}`);
    process.exitCode = 1;
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown || !httpServer) return;
    shuttingDown = true;
    console.log(`${BRAND.appName} Server received ${signal}; shutting down.`);

    // Give in-flight requests time to finish, then close remaining sockets.
    const forceCloseTimer = setTimeout(() => {
      httpServer?.closeAllConnections();
    }, 10_000);
    forceCloseTimer.unref();

    try {
      await Promise.all([
        new Promise<void>((resolve, reject) => {
          httpServer?.close((error) => (error ? reject(error) : resolve()));
        }),
        closeVite?.() ?? Promise.resolve(),
      ]);
    } catch {
      process.exitCode = 1;
      console.error('Server shutdown completed with an error.');
    } finally {
      clearTimeout(forceCloseTimer);
    }
  };

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  console.error(`Server startup failed: ${message}`);
  process.exitCode = 1;
});
