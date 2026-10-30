// TEMPORARY diagnostic endpoint — presence-only, NEVER returns secret values.
// Purpose: determine whether COACH_PIN / SESSION_SECRET reach the Vercel
// function runtime (production /api is 500ing on every route).
// This file does NOT import ../src/server/api on purpose: if the main
// module crashes at import, this route must still respond.
// DELETE after diagnosis.
export default function handler(req: any, res: any) {
  res.status(200).json({
    ok: true,
    nodeEnv: process.env.NODE_ENV || null,
    hasCoachPin: Boolean(process.env.COACH_PIN && process.env.COACH_PIN.trim()),
    hasSessionSecret: Boolean(process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim()),
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}
