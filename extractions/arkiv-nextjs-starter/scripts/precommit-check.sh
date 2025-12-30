#!/usr/bin/env bash
set -euo pipefail

echo "==> Precommit checks"

# 1) Build + typecheck
echo "==> npm run build"
npm run build

echo "==> npm run typecheck"
npm run typecheck

# 2) Whitespace checks
echo "==> git diff --check"
if ! git diff --check -- >/dev/null; then
  echo "ERROR: git diff --check found whitespace issues."
  git diff --check || true
  exit 1
fi

# 3) refs/ must never be tracked
echo "==> check tracked refs/"
if git ls-files | grep -q '^refs/'; then
  echo "ERROR: refs/ files are tracked by git. Remove them (git rm --cached) and rewrite history if already pushed."
  git ls-files | grep '^refs/' || true
  exit 1
fi

# 4) Basic secret heuristic scan (intentionally lightweight; do not rely on this alone)
echo "==> secret scan (heuristic)"
# Scan staged + tracked content for obvious red flags
if git grep -nE '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----|SECRET_KEY|API[_-]?KEY|PRIVATE[_-]?KEY|PASSWORD\s*=|TOKEN\s*=)' -- ':!package-lock.json' ':!pnpm-lock.yaml' ':!yarn.lock' >/dev/null; then
  echo "ERROR: Potential secret pattern found in repository content."
  echo "Fix before committing. Do not commit secrets."
  git grep -nE '(AKIA[0-9A-Z]{16}|-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----|SECRET_KEY|API[_-]?KEY|PRIVATE[_-]?KEY|PASSWORD\s*=|TOKEN\s*=)' -- ':!package-lock.json' ':!pnpm-lock.yaml' ':!yarn.lock' || true
  exit 1
fi

# 5) Docs scan: public docs must not contain obvious secret words
echo "==> docs scan (public-safe)"
if [ -d "docs" ]; then
  if git grep -nE '(seed phrase|mnemonic|private key|BEGIN .* PRIVATE KEY|password\s*:|token\s*:)' docs >/dev/null; then
    echo "ERROR: docs/ contains language that looks like secrets or sensitive procedures."
    echo "Move sensitive content to refs/ (and do not commit it)."
    git grep -nE '(seed phrase|mnemonic|private key|BEGIN .* PRIVATE KEY|password\s*:|token\s*:)' docs || true
    exit 1
  fi
fi

echo "==> OK: precommit checks passed"

