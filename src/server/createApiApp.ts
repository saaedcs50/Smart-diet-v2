import express, { type Express } from 'express';
import { apiRouter } from './api.js';

export interface ApiAppOptions {
  /**
   * Number of trusted reverse-proxy hops in front of this runtime.
   * Defaults to 0 so client-supplied X-Forwarded-For is never trusted by
   * a directly exposed Node server.
   */
  trustProxyHops?: number;
}

/**
 * Build the HTTP application shared by the standalone Node runtime and
 * the temporary Vercel adapter. Runtime-specific listening/deployment
 * concerns deliberately stay outside this factory.
 */
export function createApiApp(options: ApiAppOptions = {}): Express {
  const trustProxyHops = options.trustProxyHops ?? 0;

  if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new RangeError('trustProxyHops must be a non-negative safe integer.');
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops);
  app.use(apiRouter);

  return app;
}
