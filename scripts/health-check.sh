#!/bin/bash
set -e
URL="${1:-http://localhost:3000}"
echo "Checking BaseUSDP health at $URL..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL")
if [ "$HTTP_CODE" -ne 200 ]; then
  echo "FAIL: HTTP $HTTP_CODE"
  exit 1
fi
echo "OK: All health checks passed"
