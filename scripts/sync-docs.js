#!/usr/bin/env node

/**
 * src/ → docs/ 동기화 스크립트
 * 사용법: node scripts/sync-docs.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'src');
const DOCS = path.resolve(__dirname, '..', 'docs');

// 동기화 대상 디렉토리/파일
const SYNC_TARGETS = [
    'shared',
    'soil',
    'water',
    'compost',
    'heavy-metal',
    'pesticide',
    'settings',
    'label-print',
    'manual',
    'index.html',
];

// 제외 패턴 (Electron 전용 파일)
const EXCLUDE = [
    'index.js',       // Main process
    'preload.js',     // Preload script
    '*.backup',
];

function shouldExclude(filename) {
    return EXCLUDE.some(pattern => {
        if (pattern.startsWith('*')) {
            return filename.endsWith(pattern.slice(1));
        }
        return filename === pattern;
    });
}

function copyRecursive(srcDir, destDir, stats) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
        if (shouldExclude(entry.name)) continue;

        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath, stats);
        } else if (entry.isFile()) {
            fs.copyFileSync(srcPath, destPath);
            stats.copied++;
        }
    }
}

function main() {
    console.log('src/ → docs/ 동기화 시작...\n');
    const stats = { copied: 0 };

    for (const target of SYNC_TARGETS) {
        const srcPath = path.join(SRC, target);
        const destPath = path.join(DOCS, target);

        if (!fs.existsSync(srcPath)) {
            console.log(`  [skip] ${target} — src에 없음, 건너뜀`);
            continue;
        }

        const stat = fs.statSync(srcPath);

        if (stat.isDirectory()) {
            copyRecursive(srcPath, destPath, stats);
            console.log(`  [ok] ${target}/`);
        } else {
            if (!shouldExclude(path.basename(srcPath))) {
                fs.copyFileSync(srcPath, destPath);
                stats.copied++;
                console.log(`  [ok] ${target}`);
            }
        }
    }

    console.log(`\n동기화 완료: ${stats.copied}개 파일 복사됨`);
}

main();
