#!/usr/bin/env node
/**
 * 버전 동기화 스크립트
 * package.json의 version을 모든 관련 파일에 반영
 *
 * 동기화 대상:
 * 1. src/shared/constants.js → APP_VERSION
 * 2. src/index.html → #appVersion 텍스트
 * 3. src/manual/index.html → version-badge, footer 버전
 */

const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const version = pkg.version;
const vPrefix = `v${version}`;

console.log(`[sync-version] 버전 동기화 시작: ${version}`);

let updated = 0;

// 1. src/shared/constants.js — APP_VERSION
const constantsPath = path.join(__dirname, '..', 'src', 'shared', 'constants.js');
if (fs.existsSync(constantsPath)) {
    let content = fs.readFileSync(constantsPath, 'utf8');
    const before = content;
    content = content.replace(/APP_VERSION\s*[:=]\s*'[^']*'/, `APP_VERSION = '${version}'`);
    if (content !== before) {
        fs.writeFileSync(constantsPath, content);
        console.log(`  ✅ constants.js → ${version}`);
        updated++;
    } else {
        console.log(`  ⏭️  constants.js (이미 최신)`);
    }
}

// 2. src/index.html — <p ... id="appVersion">v*.*.*</p>
const indexPath = path.join(__dirname, '..', 'src', 'index.html');
if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    const before = content;
    content = content.replace(
        /(<p[^>]*id="appVersion"[^>]*>)v[\d.]+(<\/p>)/,
        `$1${vPrefix}$2`
    );
    if (content !== before) {
        fs.writeFileSync(indexPath, content);
        console.log(`  ✅ index.html → ${vPrefix}`);
        updated++;
    } else {
        console.log(`  ⏭️  index.html (이미 최신)`);
    }
}

// 3. src/manual/index.html — version-badge + footer
const manualPath = path.join(__dirname, '..', 'src', 'manual', 'index.html');
if (fs.existsSync(manualPath)) {
    let content = fs.readFileSync(manualPath, 'utf8');
    const before = content;

    // version-badge: v*.*.* - YYYY년 M월 업데이트
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    content = content.replace(
        /(<span class="version-badge">)v[\d.]+ - \d{4}년 \d{1,2}월 업데이트(<\/span>)/,
        `$1${vPrefix} - ${year}년 ${month}월 업데이트$2`
    );

    // footer: 시료 접수 대장 v*.*.*
    content = content.replace(
        /(시료 접수 대장 )v[\d.]+/,
        `$1${vPrefix}`
    );

    if (content !== before) {
        fs.writeFileSync(manualPath, content);
        console.log(`  ✅ manual/index.html → ${vPrefix}`);
        updated++;
    } else {
        console.log(`  ⏭️  manual/index.html (이미 최신)`);
    }
}

console.log(`[sync-version] 완료: ${updated}개 파일 업데이트, 버전 ${version}`);
