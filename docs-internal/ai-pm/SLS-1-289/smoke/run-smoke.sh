#!/bin/bash
# 사용: bash run-smoke.sh <라벨>  — 패키징 앱을 임시 데이터 폴더로 띄워 probe 결과를 낸다
set -u
W=.omc/sls289; L=$1
R="$HOME/Library/Application Support/토양 시료 접수 대장"
snap(){ (cd "$R" && find . -type f -exec stat -f "%m %z %N" {} \; | sort); }
snap > $W/real-before-$L.txt
node $W/evil-server.cjs > $W/evil-$L.log 2>&1 & SP=$!
sleep 1
UD=$(mktemp -d /tmp/sls289-ud.XXXX)
out/soil-sample-log-darwin-arm64/soil-sample-log.app/Contents/MacOS/soil-sample-log --user-data-dir="$UD" --remote-debugging-port=9339 > $W/app-$L.log 2>&1 & AP=$!
for i in $(seq 1 40); do curl -s http://127.0.0.1:9339/json/version >/dev/null && break; sleep 0.5; done
node $W/probe.cjs 9339 > $W/probe-$L.json 2>&1; echo "probe exit=$?"
kill $AP 2>/dev/null; sleep 1; kill -9 $AP 2>/dev/null; kill $SP 2>/dev/null
cat $W/probe-$L.json
snap > $W/real-after-$L.txt
diff -q $W/real-before-$L.txt $W/real-after-$L.txt >/dev/null && echo "실사용 폴더: 변경 없음" || echo "⚠️ 실사용 폴더 변경!"
grep -E "Vite dev server|빌드된 파일" $W/app-$L.log | head -3
rm -rf "$UD"
