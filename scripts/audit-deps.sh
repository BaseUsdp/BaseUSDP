#!/bin/bash
set -e
echo "=== Dependency Security Audit ==="
npm audit --production 2>&1 || true
echo "=== Audit complete ==="
