#!/usr/bin/env bash
# Funds a Stellar test account through Friendbot. Testnet/futurenet/local only.
# Usage: scripts/testnet-faucet.sh <G...public-key> [testnet|futurenet|local]
# Never pass secret keys. Override the endpoint with FRIENDBOT_URL if needed.
set -euo pipefail

key="${1:-}"; net="${2:-testnet}"
[[ "$key" =~ ^G[A-Z2-7]{55}$ ]] || { echo "Usage: $0 <G...public-key> [testnet|futurenet|local]" >&2; exit 2; }

case "$net" in
  testnet)   url="https://friendbot.stellar.org" ;;
  futurenet) url="https://friendbot-futurenet.stellar.org" ;;
  local)     url="http://localhost:8000/friendbot" ;;
  *) echo "Refusing network '$net' (mainnet is never funded by this script)." >&2; exit 2 ;;
esac
url="${FRIENDBOT_URL:-$url}"

echo "Funding $key on $net via $url"
code="$(curl -sS -o /tmp/faucet.out -w '%{http_code}' --get --data-urlencode "addr=$key" "$url")"
if [ "$code" -ge 200 ] && [ "$code" -lt 300 ]; then echo "Funded."; else
  echo "Friendbot returned HTTP $code (account may already be funded):" >&2; head -c 300 /tmp/faucet.out >&2; exit 1; fi
