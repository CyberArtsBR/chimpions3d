#!/usr/bin/env bash
set -euo pipefail

LOG=/tmp/chimp-reported-regressions-preview.log
npm run preview -- --host 127.0.0.1 >"$LOG" 2>&1 &
PREVIEW_PID=$!

cleanup(){
  kill "$PREVIEW_PID" 2>/dev/null || true
}
trap cleanup EXIT

ready=0
for i in $(seq 1 60); do
  if curl -fsS 'http://127.0.0.1:4173/?test=1' >/dev/null; then
    ready=1
    break
  fi
  sleep 1
done

if [ "$ready" != "1" ]; then
  cat "$LOG"
  exit 1
fi

node checks/reported-regressions-browser.mjs
