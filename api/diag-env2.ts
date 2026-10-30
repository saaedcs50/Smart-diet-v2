// DIAGNOSTIC TEMPORARY — reports which import in the api/index.ts chain fails on Vercel.
// No secret values. To be removed after diagnosis.
async function tryImport(path: string): Promise<string> {
  try {
    await import(path);
    return 'ok';
  } catch (e: any) {
    return 'FAIL: ' + String(e && e.message ? e.message : e).slice(0, 400);
  }
}

export default async function handler(_req: any, res: any) {
  const report: Record<string, string> = {
    nodeEnv: process.env.NODE_ENV ?? 'undefined',
    vercelEnv: process.env.VERCEL_ENV ?? 'undefined',
    hasCoachPin: String(!!process.env.COACH_PIN),
    hasSessionSecret: String(!!process.env.SESSION_SECRET),
  };
  report['dotenv/config'] = await tryImport('dotenv/config');
  report['express'] = await tryImport('express');
  report['../src/config/brand'] = await tryImport('../src/config/brand');
  report['../src/server/coachGuardStore'] = await tryImport('../src/server/coachGuardStore');
  report['../src/server/api'] = await tryImport('../src/server/api');
  res.status(200).json({ ok: true, report });
}
