#!/bin/bash
# 사용: 저장소 루트에서 bash <이 파일> <라벨> <포트> — 현재 docs/ 로 패키징해 클릭 프로브(clicks.cjs)를 돌린다
# 출력은 .omc/ 아래(gitignore)에 쓴다. forge 가 .env·feedback-auth.json 을 요구하므로 빈 파일을 만든다 —
# 이미 있으면 실제 자격증명일 수 있어 덮어쓰지 않고 멈춘다.
set -u; L=$1; P=$2; HERE=$(cd "$(dirname "$0")" && pwd); W=.omc/run-$L
if [ -e .env ] || [ -e feedback-auth.json ]; then echo ".env 또는 feedback-auth.json 이 이미 있다 — 실제 자격증명일 수 있어 중단"; exit 1; fi
mkdir -p "$W"; : > .env; echo '{}' > feedback-auth.json; rm -rf out
trap 'rm -rf "$UD" .env feedback-auth.json out' EXIT
npx electron-forge package > $W/pkg.log 2>&1; echo "package exit=$?"
R="$HOME/Library/Application Support/토양 시료 접수 대장"; (cd "$R" && find . -type f -exec stat -f "%m %z %N" {} \; | sort) > $W/rb.txt
UD=$(mktemp -d /tmp/s295-$L.XXXX); out/soil-sample-log-darwin-arm64/soil-sample-log.app/Contents/MacOS/soil-sample-log --user-data-dir="$UD" --remote-debugging-port=$P > $W/app.log 2>&1 & AP=$!
for i in $(seq 1 40); do curl -s http://127.0.0.1:$P/json/version >/dev/null && break; sleep 0.5; done
node "$HERE/clicks.cjs" $P > $W/clicks.txt 2>&1; cat $W/clicks.txt
kill $AP 2>/dev/null; sleep 1; kill -9 $AP 2>/dev/null
(cd "$R" && find . -type f -exec stat -f "%m %z %N" {} \; | sort) > $W/ra.txt; diff -q $W/rb.txt $W/ra.txt >/dev/null && echo "실사용 폴더: 변경 없음"
