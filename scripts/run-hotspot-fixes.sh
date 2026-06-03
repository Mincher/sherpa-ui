#!/usr/bin/env bash
# Orchestrates all hot-spot type fixes + TS2578 bulk-removal.
# Run from the repo root: bash scripts/run-hotspot-fixes.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Applying type fixes to hot-spot components ==="
python3 scripts/fix-hotspot-types.py

echo ""
echo "=== Round-2 repair fixes ==="
python3 scripts/fix-hotspot-types-round2.py

echo ""
echo "=== Round 1: removing now-unused @ts-expect-error directives ==="
node scripts/remove-ts2578.cjs

echo ""
echo "=== Round 2: removing any additional unused directives ==="
node scripts/remove-ts2578.cjs

echo ""
echo "=== Verifying type-check ==="
npm run type-check 2>&1 | grep -E "error TS" | grep -v "element-cache.test.ts" | head -20 || true

echo ""
echo "=== Suppression count ==="
node scripts/count-suppressions.js

echo ""
echo "Done."
