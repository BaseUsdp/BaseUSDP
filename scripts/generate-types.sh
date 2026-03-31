#!/bin/bash
set -e
echo "=== Generating TypeScript types ==="

echo "Generating Supabase types..."
npx supabase gen types typescript --local > src/types/supabase.ts 2>/dev/null || echo "Supabase CLI not available, skipping"

echo "Generating API route types..."
# Placeholder for future OpenAPI type generation
echo "// Auto-generated API types" > src/types/api-generated.ts

echo "=== Type generation complete ==="
