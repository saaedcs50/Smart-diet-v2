// DIAGNOSTIC TEMPORARY — decisive test: do STATIC imports bundle/load on Vercel?
// If this 500s: even static externals fail (packaging broken).
// If 200: externals fine -> the api/index.ts failure is the relative extensionless imports.
import express from 'express';

export default async function handler(_req: any, res: any) {
  let brandJs: string;
  try {
    const m: any = await import('../src/config/brand.js');
    brandJs = 'ok, brandCopy=' + String(!!m.brandCopy);
  } catch (e: any) {
    brandJs = 'FAIL: ' + String(e && e.message ? e.message : e).slice(0, 300);
  }
  res.status(200).json({ ok: true, expressStatic: 'loaded', brandJs });
}
