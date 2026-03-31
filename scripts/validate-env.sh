#!/bin/bash
set -e
echo "=== Validating environment variables ==="

ERRORS=0

check_var() {
  local var_name="$1"
  local required="$2"
  if [ -z "${!var_name}" ]; then
    if [ "$required" = "required" ]; then
      echo "MISSING (required): $var_name"
      ERRORS=$((ERRORS + 1))
    else
      echo "MISSING (optional): $var_name"
    fi
  else
    echo "OK: $var_name"
  fi
}

# Load env file
if [ -f .env.local ]; then
  set -a
  source .env.local
  set +a
fi

echo ""
echo "--- Required Variables ---"
check_var "NEXT_PUBLIC_SUPABASE_URL" "required"
check_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "required"
check_var "NEXT_PUBLIC_CHAIN_ID" "required"

echo ""
echo "--- Optional Variables ---"
check_var "NEXT_PUBLIC_RPC_URL" "optional"
check_var "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" "optional"
check_var "NEXT_PUBLIC_GA_TRACKING_ID" "optional"

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "=== Validation FAILED: $ERRORS required variables missing ==="
  exit 1
else
  echo "=== Validation PASSED ==="
fi
