#!/usr/bin/env bash
# Shows which stacks changed vs a base ref and the matching check commands.
# Usage: scripts/pr-preflight.sh [base-ref]   (default: upstream/main, else origin/main)
# Set RUN=1 to execute the commands instead of only printing them.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

base="${1:-}"
if [ -z "$base" ]; then
  git rev-parse --verify -q upstream/main >/dev/null && base=upstream/main || base=origin/main
fi
git rev-parse --verify -q "$base" >/dev/null || { echo "Unknown base ref: $base" >&2; exit 2; }

changed="$(git diff --name-only "$base"...HEAD)"
cmds=("git diff --check $base...HEAD")
has() { grep -qE "$1" <<<"$changed"; }

has '^frontend/'                  && cmds+=("(cd frontend && corepack pnpm lint && corepack pnpm build && corepack pnpm test)")
has '^backend/'                   && cmds+=("(cd backend && corepack pnpm build && corepack pnpm test)")
has '^mobile/'                    && cmds+=("(cd mobile && corepack pnpm exec tsc --noEmit && corepack pnpm lint && corepack pnpm test)")
has '^contracts/'                 && cmds+=("(cd contracts/amana_escrow && cargo test --locked)")
has '^scripts/'                   && cmds+=("npm run test:scripts")

echo "Base: $base"; echo "Changed files: $(grep -c . <<<"$changed" || true)"
echo "Commands:"; printf '  %s\n' "${cmds[@]}"
[ "${RUN:-0}" = 1 ] || exit 0
for c in "${cmds[@]}"; do echo "+ $c"; bash -c "$c"; done
