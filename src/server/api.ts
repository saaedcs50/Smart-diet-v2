// Express adapter for the coach session API (Vercel serverless + local Node).
// The session logic lives in the framework-free coachSessionService.ts and is
// shared with the Cloudflare Worker (Hono) adapter — this file only maps
// Express req/res onto the service, so the response contracts stay identical
// across runtimes.
import express, { Router, Request, Response, NextFunction } from 'express';
import {
  createCoachSession,
  deleteCoachSession,
  createSignedCoachToken,
  verifySignedCoachToken,
  validateSecurityConfig,
} from './coachSessionService.js';

// Re-exported so existing imports (adapters, tests) keep working; the
// implementation lives in the framework-free service.
export { createSignedCoachToken, verifySignedCoachToken, validateSecurityConfig };

export const apiRouter = Router();

// Keep the request-size boundary identical for every Express runtime.
apiRouter.use(express.json({ limit: '200kb' }));

// 1. Health Check — intentionally independent from secrets and dependencies.
const handleHealth = (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
};

// 2. Create Session (مُصدَّر للاختبارات)
export const handleCreateSession = async (req: Request, res: Response) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const result = await createCoachSession({ ip, pin: req.body?.pin });
  res.status(result.status).json(result.body);
};

// 3. Delete Session
const handleDeleteSession = async (req: Request, res: Response) => {
  const headerToken = req.headers['x-coach-session'] as string;
  const bodyToken = req.body?.token as string;
  const result = await deleteCoachSession({ token: headerToken || bodyToken });
  res.status(result.status).json(result.body);
};

// Register routes both with and without /api prefix to support all proxy/rewrite configurations.
apiRouter.get('/health', handleHealth);
apiRouter.get('/api/health', handleHealth);

apiRouter.post('/coach-session', handleCreateSession);
apiRouter.post('/api/coach-session', handleCreateSession);

apiRouter.delete('/coach-session', handleDeleteSession);
apiRouter.delete('/api/coach-session', handleDeleteSession);

// Keep unknown API routes on a predictable JSON contract across runtimes.
apiRouter.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ ok: false, error: 'المسار غير موجود.' });
});

// Never return parser details or stack traces to API clients.
apiRouter.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const candidate = error as { status?: number; statusCode?: number };
    const rawStatus = candidate?.status ?? candidate?.statusCode;
    const status = rawStatus === 400 || rawStatus === 413 ? rawStatus : 500;
    const message =
      status === 400
        ? 'طلب غير صالح.'
        : status === 413
          ? 'حجم الطلب أكبر من المسموح.'
          : 'خطأ داخلي في الخادم. حاول مرة أخرى.';

    res.status(status).json({ ok: false, error: message });
  }
);
