#!/bin/bash
# 실사용 데이터 폴더의 파일 목록(경로·크기·mtime)
D="$HOME/Library/Application Support/토양 시료 접수 대장"
[ -d "$D" ] || { echo "NO_DIR"; exit 0; }
find "$D" -type f -print0 | xargs -0 stat -f '%N|%z|%m' | sort
