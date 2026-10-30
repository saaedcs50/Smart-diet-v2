import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import { apiRouter, validateSecurityConfig } from './src/server/api';
import { BRAND } from './src/config/brand';

const app = express();
// خلف بروكسي واحد (Vercel/الاستضافة): req.ip الحقيقي — القيمة رقم لا true أبدًا
app.set('trust proxy', 1);
const PORT = 3000;

app.use(express.json({ limit: '200kb' }));

// Mount API router
app.use(apiRouter);

async function start() {
  // يوقف السيرفر فورًا (قبل ما يستقبل أي طلب) لو إعدادات الأمان ناقصة في الإنتاج
  validateSecurityConfig();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`${BRAND.appName} Server listening on port ${PORT}`);
  });
}

start();
