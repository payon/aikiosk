#!/bin/bash
# 전체 스택 기동 (npm 방식). 사용법: ./run.sh [start|stop|status]
DIR="$(cd "$(dirname "$0")" && pwd)"
start_one() {
  local name=$1 dir=$2 port=$3 cmd=$4
  if ss -tln 2>/dev/null | grep -q ":$port "; then echo "$name :$port already up"; return; fi
  cd "$DIR/$dir" && PORT=$port nohup $cmd > /tmp/aikiosk-$name.log 2>&1 &
  echo "$name starting..."
}
stop_one() {
  local name=$1 port=$2
  for pid in $(ss -tlnp 2>/dev/null | grep ":$port " | grep -oP 'pid=\K[0-9]+' | sort -u); do
    if tr '\0' ' ' < /proc/$pid/cmdline 2>/dev/null | grep -qE "aikiosk"; then kill "$pid" && echo "$name($pid) stopped"; fi
  done
}
case "${1:-status}" in
  start)
    start_one backend apps/api-server 4501 "node server.js"
    sleep 2
    start_one library apps/library 4511 "npm run start"
    start_one aiplatform apps/aiplatform 4512 "npm run start"
    start_one healthcare apps/healthcare 4513 "npm run start"
    start_one core apps/core-platform 4500 "npm run start"
    start_one admin apps/admin 4502 "npm run start"
    ;;
  stop)
    for p in 4500 4501 4502 4511 4512 4513; do stop_one "port$p" $p; done
    ;;
  status)
    for p in 4500 4501 4502 4511 4512 4513; do
      if ss -tln 2>/dev/null | grep -q ":$p "; then echo "$p UP"; else echo "$p DOWN"; fi
    done
    ;;
esac
