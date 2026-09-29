#!/usr/bin/env bash
# lock이 Windows(x64)에서 npm ci로 설치될 수 있는지 로컬에서 확인한다 (SLS-1-286).
# npm ci --dry-run은 lock에 없는 optional 바이너리를 문제 삼지 않으므로(npm/cli#4828)
# 임시 폴더에 win32로 실제 설치한 뒤, Windows x64용 optional 의존성이 모두 해석되는지 본다.
# 후보는 lock의 os/cpu 또는 이름 규칙으로 고른다 — lock에서 통째로 빠진 항목은 이름으로만 알 수 있다.
# 사용: bash docs-internal/ai-pm/SLS-1-286/check-lock-win32.sh [저장소 루트]
set -euo pipefail
ROOT=$(cd "${1:-.}" && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$TMP/"
[ -f "$ROOT/.npmrc" ] && cp "$ROOT/.npmrc" "$TMP/"

show_error() { grep -E 'npm error (code|Missing|Invalid)' "$1" || tail -20 "$1"; }

echo "[1/3] lock ↔ package.json 동기화 (npm ci --dry-run)"
npm ci --dry-run --ignore-scripts --prefix "$TMP" >"$TMP/dry.log" 2>&1 || { show_error "$TMP/dry.log"; exit 1; }

echo "[2/3] win32/x64로 실제 설치 (스크립트 생략)"
npm ci --ignore-scripts --no-audit --no-fund --os=win32 --cpu=x64 --prefix "$TMP" >"$TMP/win.log" 2>&1 || { show_error "$TMP/win.log"; exit 1; }
grep -m1 "added" "$TMP/win.log" || true

echo "[3/3] 설치된 패키지의 Windows x64 optional 의존성이 해석되는가"
node - "$TMP" "$(npm root -g)/npm/node_modules/semver" <<'NODE'
const fs = require('fs');
const path = require('path');
const [root, semverPath] = process.argv.slice(2);
const semver = require(fs.existsSync(semverPath) ? semverPath : path.join(root, 'node_modules/semver'));
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const WIN_X64_NAME = /win(32|dows)[-_]?(x64|amd64|64)/i;
// Node 해석 규칙: 패키지 폴더에서 위로 올라가며 node_modules/<name>을 찾는다. 찾은 경로를 lock 키로 돌려준다
function resolveKey(fromKey, name) {
  for (let k = fromKey; ; k = k.slice(0, Math.max(0, k.lastIndexOf('/node_modules/')))) {
    const cand = (k ? k + '/' : '') + 'node_modules/' + name;
    if (lock.packages[cand] || fs.existsSync(path.join(root, cand))) return cand;
    if (!k) return null;
  }
}
const isWinX64 = (e) => e && (e.os || []).includes('win32') && (e.cpu || []).includes('x64');
let missing = 0;
const checked = new Set();
for (const [key, entry] of Object.entries(lock.packages)) {
  if (key && !fs.existsSync(path.join(root, key))) continue; // Windows에서 건너뛴 패키지(fsevents 등)
  // 목록은 설치된 package.json에서 읽는다 — lock의 부모 항목에서 빠진 줄은 lock만 봐서는 안 보인다
  const ownPj = path.join(root, key, 'package.json');
  const optional = fs.existsSync(ownPj)
    ? JSON.parse(fs.readFileSync(ownPj, 'utf8')).optionalDependencies
    : entry.optionalDependencies;
  for (const [name, range] of Object.entries(optional || {})) {
    const found = resolveKey(key, name);
    if (!WIN_X64_NAME.test(name) && !isWinX64(found && lock.packages[found])) continue;
    checked.add(name);
    const pj = found && path.join(root, found, 'package.json');
    const version = pj && fs.existsSync(pj) && JSON.parse(fs.readFileSync(pj, 'utf8')).version;
    if (version && semver.satisfies(version, range)) continue;
    missing++;
    console.log(`  MISSING ${name}@${range}  (${key}의 optional 의존성${version ? `, 찾은 것은 ${version}` : ''})`);
  }
}
console.log(`  확인: ${[...checked].sort().join(', ')}`);
console.log(`  Windows x64 optional 의존성 ${checked.size}종 확인, 누락 ${missing}건`);
if (checked.size === 0) { console.log('  확인한 것이 없다 — 검사 자체가 잘못됐다'); process.exit(1); }
process.exit(missing ? 1 : 0);
NODE
