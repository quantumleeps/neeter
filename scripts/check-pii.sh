#!/usr/bin/env bash
# PII pattern scanner for pre-commit
# Scans staged files for SSNs, phone numbers, and email addresses
# Skips test directories and known safe placeholder values

set -euo pipefail

FAILED=0

# Patterns to detect
SSN_PATTERN='\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b'
PHONE_PATTERN='\b(\+?1[-. ]?)?\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}\b'
EMAIL_PATTERN='\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'

# Safe patterns to ignore (false positives)
SAFE_PATTERNS='example\.com|test@test|000-00-0000|555-[0-9]{4}|123-45-6789|placeholder|xxx-xx-xxxx|noreply@|localhost'

scan_pattern() {
  local label="$1"
  local pattern="$2"

  while IFS= read -r file; do
    matches=$(grep -nEi "$pattern" "$file" 2>/dev/null | grep -vEi "$SAFE_PATTERNS" || true)
    if [ -n "$matches" ]; then
      echo "[$label] Found in $file:"
      echo "$matches"
      echo ""
      FAILED=1
    fi
  done
}

# Get staged files, excluding tests/fixtures/docs
git diff --cached --name-only --diff-filter=ACM \
  | grep -vE '^(tests?/|test_|fixtures?/|mock/|__mocks__/)' \
  | grep -vE '\.(md|txt|lock)$' \
  | scan_pattern "SSN" "$SSN_PATTERN"

git diff --cached --name-only --diff-filter=ACM \
  | grep -vE '^(tests?/|test_|fixtures?/|mock/|__mocks__/)' \
  | grep -vE '\.(md|txt|lock)$' \
  | scan_pattern "PHONE" "$PHONE_PATTERN"

git diff --cached --name-only --diff-filter=ACM \
  | grep -vE '^(tests?/|test_|fixtures?/|mock/|__mocks__/)' \
  | grep -vE '\.(md|txt|lock)$' \
  | scan_pattern "EMAIL" "$EMAIL_PATTERN"

if [ "$FAILED" -ne 0 ]; then
  echo "PII check failed. If these are intentional (test data, examples), move them to a test/ or fixtures/ directory."
  exit 1
fi
