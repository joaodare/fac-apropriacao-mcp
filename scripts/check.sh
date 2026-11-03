#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npx tsc --noEmit
npm test
