# Production Schema Baseline

## Purpose

`supabase/baselines/production-schema.sql` is a schema-only reference snapshot captured from the live Production catalog on 17 November 2026. The Production catalog was re-counted on 21 November 2026 and still reports 11 tables, 33 constraints, 23 indexes, 19 routines, 2 triggers, 40 policies and RLS enabled on all 11 application tables.

The snapshot contains application-owned DDL for `public` and `private`; it does not contain patient/clinic rows, credentials or Vault secret values. The Staging-only `appointments` table is intentionally excluded.

## Hard safety boundary

**Only use this file against a disposable, clean Supabase project/database created for restore validation. Never execute it against the existing Production or Staging project. Never treat it as a repair migration for an already-provisioned database.**

The source migration history is environment-specific and is not yet reconciled into a clean, common, one-command bootstrap chain. This baseline is kept separately from `supabase/migrations`; it must not be inserted into either existing remote migration ledger.

A schema-only baseline is not a database backup. It cannot restore patient or clinic data. The current Supabase Free plan does not provide the managed backup/PITR/restore path documented in the Phase 1 audit.

## Managed Supabase prerequisites and omissions

Before a real disposable Supabase restore test, the target project must already provide the managed roles and objects referenced by the schema:
- Supabase roles and Auth objects (including `auth.users` and Auth functions).
- Supabase-managed `extensions` namespace and required extensions.
- Vault schema/table and separately provisioned signing secrets.
- The `supabase_realtime` publication.

The PGlite validator creates local role/Auth/Vault stubs, removes extension installation statements, and skips the publication DDL. Therefore its PASS result validates PostgreSQL parsing/object reconstruction and selected ACL invariants only; **it is not a full restore test in a Supabase project**.

## Validation

Run locally/CI with Node.js 24:
```sh
npm install --no-save --package-lock=false @electric-sql/pglite@0.5.16
node scripts/validate-production-baseline.mjs
```

The validator asserts the captured object counts, RLS coverage, least-privilege table grants and `SECURITY DEFINER` search-path protection.

## Future snapshot export

Use `scripts/export-production-schema.sh` only from a secure operator shell with an explicitly supplied Production database connection string in `SUPABASE_DB_URL`. Do not put the connection string in GitHub Actions, a committed file, a chat, or the repository. Review the exported file for secrets, ownership, extensions and managed dependencies before updating the snapshot.

Exporting the schema is read-only; it does not make a recoverable data backup and does not authorize executing the resulting SQL on Production.
