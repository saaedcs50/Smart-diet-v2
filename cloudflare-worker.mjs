import { DurableObject } from "cloudflare:workers";
import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import express from "express";
import { apiRouter, validateSecurityConfig } from "./src/server/api.ts";
import { configureCoachGuardStore } from "./src/server/coachGuardStore.ts";
import { setServerRuntimeEnv } from "./src/server/runtimeEnv.ts";

const LOCKOUT_MS = 5 * 60 * 1000;
const MAX_LOCKOUT_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_TTL_MS = 65 * 60 * 1000;

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class CoachGuardDurableObject extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS coach_rate_limits (
        ip_hash TEXT PRIMARY KEY,
        attempt_count INTEGER NOT NULL,
        locked_until INTEGER NOT NULL,
        lockouts INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS coach_revoked_tokens (
        token_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL
      );
    `);
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body;
    try { body = await request.json(); }
    catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }

    const path = new URL(request.url).pathname;
    try {
      switch (path) {
        case "/record-failed-attempt": {
          const ip = String(body.ip || "").slice(0, 128);
          if (!ip) return Response.json({ error: "Invalid IP" }, { status: 400 });
          await this.recordFailedAttempt(ip);
          return Response.json({ ok: true });
        }
        case "/is-locked-out": {
          const ip = String(body.ip || "").slice(0, 128);
          return Response.json({ locked: ip ? await this.isLockedOut(ip) : false });
        }
        case "/clear-attempts": {
          const ip = String(body.ip || "").slice(0, 128);
          if (ip) await this.clearAttempts(ip);
          return Response.json({ ok: true });
        }
        case "/revoke-token": {
          const token = typeof body.token === "string" ? body.token : "";
          const expiresAt = Number(body.expiresAt);
          if (!token || !Number.isFinite(expiresAt)) return Response.json({ error: "Invalid token" }, { status: 400 });
          await this.revokeToken(token, expiresAt);
          return Response.json({ ok: true });
        }
        case "/is-revoked": {
          const token = typeof body.token === "string" ? body.token : "";
          return Response.json({ revoked: token ? await this.isRevoked(token) : false });
        }
        default:
          return Response.json({ error: "Not found" }, { status: 404 });
      }
    } catch {
      return Response.json({ error: "Durable guard store unavailable" }, { status: 503 });
    }
  }

  async recordFailedAttempt(ip) {
    const ipHash = await sha256Hex(ip);
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql
        .exec("SELECT attempt_count, locked_until, lockouts, expires_at FROM coach_rate_limits WHERE ip_hash = ?1", ipHash)
        .toArray()[0];
      let count = row && row.expires_at > now ? row.attempt_count : 0;
      let lockedUntil = row && row.expires_at > now ? row.locked_until : 0;
      let lockouts = row && row.expires_at > now ? row.lockouts : 0;
      if (lockedUntil <= now) lockedUntil = 0;
      count += 1;
      if (count >= MAX_ATTEMPTS) {
        lockedUntil = now + Math.min(LOCKOUT_MS * 2 ** lockouts, MAX_LOCKOUT_MS);
        lockouts += 1;
        count = 0;
      }
      this.ctx.storage.sql.exec(
        "INSERT INTO coach_rate_limits (ip_hash, attempt_count, locked_until, lockouts, expires_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(ip_hash) DO UPDATE SET attempt_count=excluded.attempt_count, locked_until=excluded.locked_until, lockouts=excluded.lockouts, expires_at=excluded.expires_at",
        ipHash, count, lockedUntil, lockouts, now + RATE_LIMIT_TTL_MS,
      );
    });
  }

  async isLockedOut(ip) {
    const ipHash = await sha256Hex(ip);
    const now = Date.now();
    let locked = false;
    this.ctx.storage.transactionSync(() => {
      const row = this.ctx.storage.sql
        .exec("SELECT attempt_count, locked_until, lockouts, expires_at FROM coach_rate_limits WHERE ip_hash = ?1", ipHash)
        .toArray()[0];
      if (!row) return;
      if (row.expires_at <= now || row.locked_until <= now) {
        if (row.locked_until > 0 || row.expires_at <= now) {
          this.ctx.storage.sql.exec(
            "UPDATE coach_rate_limits SET attempt_count=0, locked_until=0, expires_at=?2 WHERE ip_hash=?1",
            ipHash, now + RATE_LIMIT_TTL_MS,
          );
        }
        return;
      }
      locked = true;
    });
    return locked;
  }

  async clearAttempts(ip) {
    const ipHash = await sha256Hex(ip);
    this.ctx.storage.sql.exec("DELETE FROM coach_rate_limits WHERE ip_hash = ?1", ipHash);
  }

  async revokeToken(token, expiresAt) {
    const tokenHash = await sha256Hex(token);
    this.ctx.storage.sql.exec(
      "INSERT INTO coach_revoked_tokens (token_hash, expires_at) VALUES (?1, ?2) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at",
      tokenHash, expiresAt,
    );
  }

  async isRevoked(token) {
    const tokenHash = await sha256Hex(token);
    const row = this.ctx.storage.sql
      .exec("SELECT expires_at FROM coach_revoked_tokens WHERE token_hash = ?1", tokenHash)
      .toArray()[0];
    if (!row) return false;
    if (row.expires_at <= Date.now()) {
      this.ctx.storage.sql.exec("DELETE FROM coach_revoked_tokens WHERE token_hash = ?1", tokenHash);
      return false;
    }
    return true;
  }
}

class DurableCoachGuardStore {
  constructor(namespace) {
    this.stub = namespace.get(namespace.idFromName("smart-diet-coach-global"));
  }
  async call(path, body) {
    const response = await this.stub.fetch(new Request(`https://coach-guard.internal${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Coach guard store unavailable");
    return data;
  }
  async recordFailedAttempt(ip) { await this.call("/record-failed-attempt", { ip }); }
  async isLockedOut(ip) { return (await this.call("/is-locked-out", { ip })).locked === true; }
  async clearAttempts(ip) { await this.call("/clear-attempts", { ip }); }
  async revokeToken(token, expiresAt) { await this.call("/revoke-token", { token, expiresAt }); }
  async isRevoked(token) { return (await this.call("/is-revoked", { token })).revoked === true; }
}

let bootPromise;
async function ensureServer(env) {
  if (!bootPromise) {
    bootPromise = (async () => {
      setServerRuntimeEnv({
        NODE_ENV: "production",
        COACH_PIN: env.COACH_PIN,
        SESSION_SECRET: env.SESSION_SECRET,
      });
      configureCoachGuardStore(new DurableCoachGuardStore(env.COACH_GUARD));
      validateSecurityConfig();
      const app = express();
      app.set("trust proxy", 1);
      app.use(express.json({ limit: "200kb" }));
      app.use(apiRouter);
      const server = createServer(app);
      server.listen(3000);
    })();
  }
  return bootPromise;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith("/api/") || url.pathname === "/health" || url.pathname === "/coach-session";
    if (!isApi) return env.ASSETS.fetch(request);
    try {
      await ensureServer(env);
      return await handleAsNodeRequest(3000, request);
    } catch (error) {
      console.error("Cloudflare Worker startup/API failure", error);
      return Response.json({ ok: false, error: "الخادم غير مهيأ. راجع إعدادات التشغيل." }, { status: 503 });
    }
  },
};
