import 'dotenv/config';
import { createApiApp } from '../src/server/createApiApp.js';
import { validateSecurityConfig } from '../src/server/api.js';

// Vercel is one trusted proxy hop. The route handlers and middleware are
// created by the same factory used by the standalone Node entry point.
const app = createApiApp({ trustProxyHops: 1 });

// Fail fast during cold start if production security settings are incomplete.
validateSecurityConfig();

export default app;
