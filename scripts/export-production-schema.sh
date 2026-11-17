#!/usr/bin/env bash
set -euo pipefail

# Export only application-owned schemas. Supabase-managed auth/storage schemas
# are platform-managed and intentionally excluded from the app baseline.
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Production database connection string}"
command -v supabase >/dev/null 2>&1 || {
  echo "Supabase CLI is required (install it before running this script)." >&2
  exit 127
}

OUT="${1:-supabase/baselines/production-schema.sql}"
mkdir -p "$(dirname "$OUT")"

supabase db dump \
  --db-url "$SUPABASE_DB_URL" \
  --schema public,private \
  --file "$OUT"

test -s "$OUT" || {
  echo "Schema export is empty; refusing to report success." >&2
  exit 1
}

echo "Application schema exported to $OUT"
echo "Review secrets, owners, extensions, grants and platform-managed dependencies before committing."
