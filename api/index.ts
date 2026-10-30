import 'dotenv/config';
import express from 'express';
import { apiRouter, validateSecurityConfig } from '../src/server/api.js';

const app = express();
// خلف بروكسي واحد (Vercel): req.ip الحقيقي — القيمة رقم لا true أبدًا
app.set('trust proxy', 1);

// يفشل بسرعة (في الـ logs) لو SESSION_SECRET أو COACH_PIN مش متحددين في بيئة الإنتاج
validateSecurityConfig();

app.use(express.json({ limit: '200kb' }));
app.use(apiRouter);

export default app;
