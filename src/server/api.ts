// Express adapter for the coach session API (Vercel serverless + local Node).
// The session logic lives in the framework-free coachSessionService.ts and is
// shared with the Cloudflare Worker (Hono) adapter — this file only maps
// Express req/res onto the service, so the response contracts stay identical
// across runtimes.
import express, { Router, Request, Response } from 'express';
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

// Ensure body parser is applied to all api routes
apiRouter.use(express.json({ limit: '200kb' }));

// 1. Health Check
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

// Register routes both with and without /api prefix to support all proxy/rewrite configurations
apiRouter.get('/health', handleHealth);
apiRouter.get('/api/health', handleHealth);

apiRouter.post('/coach-session', handleCreateSession);
apiRouter.post('/api/coach-session', handleCreateSession);

apiRouter.delete('/coach-session', handleDeleteSession);
apiRouter.delete('/api/coach-session', handleDeleteSession);
