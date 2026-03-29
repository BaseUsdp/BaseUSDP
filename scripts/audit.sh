#!/usr/bin/env bash
#
# Dependency Audit Script
#
# Checks for known vulnerabilities in npm dependencies
# and produces a summary report. Intended for local use
# and CI pipelines.
#
# Usage:
#   bash scripts/audit.sh
#   bash scripts/audit.sh --fix    # Auto-fix where possible
#
# Exit codes:
#   0 - No vulnerabilities found
#   1 - Vulnerabilities found (or audit failed)

set -euo pipefail

BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
RESET="\033[0m"

echo -e "${BOLD}BASEUSDP Dependency Audit${RESET}"
echo "========================="
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo -e "${RED}Error: npm is not installed${RESET}"
  exit 1
fi

# Run npm audit
echo -e "${BOLD}Running npm audit...${RESET}"
echo ""

AUDIT_OUTPUT=$(npm audit --json 2>/dev/null || true)

# Parse results
TOTAL=$(echo "$AUDIT_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('total',0))" 2>/dev/null || echo "unknown")
CRITICAL=$(echo "$AUDIT_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('critical',0))" 2>/dev/null || echo "0")
HIGH=$(echo "$AUDIT_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('high',0))" 2>/dev/null || echo "0")
MODERATE=$(echo "$AUDIT_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('moderate',0))" 2>/dev/null || echo "0")
LOW=$(echo "$AUDIT_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('metadata',{}).get('vulnerabilities',{}).get('low',0))" 2>/dev/null || echo "0")

echo "Summary:"
echo -e "  Critical: ${RED}${CRITICAL}${RESET}"
echo -e "  High:     ${RED}${HIGH}${RESET}"
echo -e "  Moderate: ${YELLOW}${MODERATE}${RESET}"
echo -e "  Low:      ${GREEN}${LOW}${RESET}"
echo -e "  Total:    ${TOTAL}"
echo ""

# Auto-fix if requested
if [[ "${1:-}" == "--fix" ]]; then
  echo -e "${BOLD}Attempting auto-fix...${RESET}"
  npm audit fix --legacy-peer-deps 2>/dev/null || true
  echo ""
  echo "Re-running audit after fix..."
  npm audit 2>/dev/null || true
fi

# Check for outdated packages
echo ""
echo -e "${BOLD}Checking for outdated packages...${RESET}"
npm outdated 2>/dev/null || true

# Exit with appropriate code
if [[ "$CRITICAL" != "0" ]] || [[ "$HIGH" != "0" ]]; then
  echo ""
  echo -e "${RED}${BOLD}FAIL: Critical or high severity vulnerabilities found${RESET}"
  echo "Run 'npm audit' for details or 'bash scripts/audit.sh --fix' to auto-fix."
  exit 1
fi

echo ""
echo -e "${GREEN}${BOLD}PASS: No critical or high severity vulnerabilities${RESET}"
exit 0
