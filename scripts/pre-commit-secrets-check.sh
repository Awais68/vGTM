#!/bin/sh
#
# Pre-commit hook — blocks commits that contain secrets in staged files.
# Designed to run as a git hook (.git/hooks/pre-commit) or via Husky.
#

RED='\033[0;31m'
NC='\033[0m'

PATTERNS="api_key|ANTHROPIC|HEYREACH|SUPABASE_SERVICE_ROLE|ADMIN_PANEL_PASSWORD|ADMIN_SESSION_SALT|password"

STAGED=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED" ]; then
  exit 0
fi

VIOLATIONS=$(echo "$STAGED" | xargs grep -lnE "$PATTERNS" 2>/dev/null || true)

# Exclude .env.example from the check
ALLOWED=".env.example"
FILTERED=""
for f in $VIOLATIONS; do
  skip=0
  for a in $ALLOWED; do
    if [ "$f" = "$a" ]; then
      skip=1
    fi
  done
  if [ "$skip" = "0" ]; then
    FILTERED="$FILTERED $f"
  fi
done

if [ -n "$FILTERED" ]; then
  echo "${RED}[SECURITY] Potential secrets found in staged files:${NC}"
  for f in $FILTERED; do
    echo "  ✗ $f"
  done
  echo ""
  echo "If this is a false positive, use: git commit --no-verify"
  exit 1
fi

exit 0
