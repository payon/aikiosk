#!/bin/bash
# 감시견: 30초마다 포트 확인, 죽으면 run.sh start로 부활. 종료되지 않음.
# 실행: setsid nohup /home/payon/develop/aikiosk/watchdog.sh >/tmp/aikiosk-watchdog.log 2>&1 < /dev/null &
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[watchdog] started at $(date)"
while true; do
  for spec in "backend:4501" "core:4500" "admin:4502" "library:4511" "aiplatform:4512" "healthcare:4513"; do
    port=${spec##*:}
    if ! ss -tln 2>/dev/null | grep -q ":$port "; then
      echo "[watchdog] $(date) :$port DOWN -> restart"
      "$DIR/run.sh" start >> /tmp/aikiosk-watchdog.log 2>&1
      break
    fi
  done
  sleep 30
done
