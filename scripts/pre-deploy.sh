#!/bin/bash
set -e
echo "=== Pre-deployment checks ==="

echo "1. Validating environment..."
./scripts/validate-env.sh

echo ""
echo "2. Running type check..."
npx tsc --noEmit || { echo "TypeScript errors found"; exit 1; }

echo ""
echo "3. Running linter..."
npm run lint || { echo "Lint errors found"; exit 1; }

echo ""
echo "4. Running tests..."
npm test -- --ci || { echo "Tests failed"; exit 1; }

echo ""
echo "5. Building application..."
npm run build || { echo "Build failed"; exit 1; }

echo ""
echo "=== All pre-deployment checks passed ==="
echo "Safe to deploy."
