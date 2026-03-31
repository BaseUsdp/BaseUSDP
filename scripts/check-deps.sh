#!/bin/bash
set -e
echo "=== Checking for outdated dependencies ==="
echo ""
echo "--- Production dependencies ---"
npx npm-check-updates --dep prod 2>/dev/null || echo "Run: npm install -g npm-check-updates"
echo ""
echo "--- Development dependencies ---"
npx npm-check-updates --dep dev 2>/dev/null || echo "Run: npm install -g npm-check-updates"
echo ""
echo "--- Security audit ---"
npm audit --production 2>/dev/null || echo "Some vulnerabilities found. Run 'npm audit fix' to resolve."
echo ""
echo "=== Dependency check complete ==="
