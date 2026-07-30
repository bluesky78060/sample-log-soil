#!/usr/bin/env node
/**
 * extract-whatsnew.js — 릴리스 노트에서 "주요 수정사항" 팝업 데이터를 추출 (SLS-1-218)
 *
 * src/release/index.html  →  src/shared/whatsnew-data.js
 *
 * ## 왜 빌드 시에 뽑나
 * 패키지본은 file:// 에서 뜨는데(src/index.js:376 loadFile), Chromium이 file:// 리소스
 * 간 fetch/XHR을 CORS 상 차단한다 — 각 file:// 문서를 별도 출처로 취급하고 로컬 파일은
 * Access-Control-Allow-Origin을 줄 수 없다. CSP에 file:을 추가해도 안 된다.
 * 그래서 런타임 fetch 대신 빌드 시 추출한다. 108KB HTML 파싱 비용도 함께 사라진다.
 *
 * ## 무엇을 뽑나 — 관리자가 지정한 것만
 * 제목에 "중요"가 있는지로 추론하지 않는다. 작성자가 data-popup을 직접 붙인다.
 *
 *   <div class="version-entry" data-popup>   → 그 버전의 모든 li
 *   <li data-popup>…</li>                     → 표시된 li만
 *   (둘 다 없음)                               → 그 버전은 팝업에 안 나옴
 *
 * 모든 릴리스가 팝업까지 필요하지 않다. v1.14.3(데이터 유실)은 띄우고
 * v1.14.2(날짜 서식)는 안 띄우는 판단을 작성자가 한다.
 *
 * ## 의존하는 HTML 계약 (바뀌면 이 스크립트를 함께 고칠 것)
 *   .version-entry / .version-number / .version-title / .change-list li / [data-popup]
 *
 * ## ⚠️ 정규식으로 파싱하지 말 것
 * release/index.html의 li 안에는 <strong>뿐 아니라 <code>&lt;select …&gt;</code> 같은
 * 코드 스니펫이 13곳 있다. 정규식으로 <strong>만 걷어내면 <code> 태그와 이스케이프된
 * &lt; 가 그대로 팝업에 노출된다. jsdom의 textContent가 태그 제거와 엔티티 디코드를
 * 함께 해결한다.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_HTML = path.join(ROOT, 'src', 'release', 'index.html');
const OUT_FILE = path.join(ROOT, 'src', 'shared', 'whatsnew-data.js');

/** v 접두사를 떼어 constants.js의 APP_VERSION과 같은 포맷으로 맞춘다 */
function normalizeVersion(text) {
    return String(text || '').trim().replace(/^v/i, '');
}

function main() {
    const appVersion = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')
    ).version;

    const dom = new JSDOM(fs.readFileSync(RELEASE_HTML, 'utf8'));
    const doc = dom.window.document;

    const allEntries = [...doc.querySelectorAll('.version-entry')];
    if (allEntries.length === 0) {
        console.error('[extract-whatsnew] .version-entry를 하나도 찾지 못했습니다.');
        console.error('  릴리스 노트의 HTML 구조가 바뀌었는지 확인하세요.');
        console.error(`  대상: ${RELEASE_HTML}`);
        process.exit(1);
    }

    // 현재 앱 버전 항목이 릴리스 노트에 있는지 — CLAUDE.md의 "릴리스 노트 먼저 추가"를
    // 기계적으로 강제한다. 없으면 사용자에게 변경 내역이 노출되지 않는다.
    const versionsInNotes = allEntries.map((el) =>
        normalizeVersion(el.querySelector('.version-number')?.textContent)
    );
    if (!versionsInNotes.includes(appVersion)) {
        console.error(`[extract-whatsnew] package.json 버전(${appVersion}) 항목이 릴리스 노트에 없습니다.`);
        console.error('  src/release/index.html에 새 버전 항목을 먼저 추가하세요 (CLAUDE.md 규칙).');
        console.error(`  릴리스 노트의 최신 버전: ${versionsInNotes[0] || '(없음)'}`);
        process.exit(1);
    }

    const entries = [];
    for (const el of allEntries) {
        const version = normalizeVersion(el.querySelector('.version-number')?.textContent);
        if (!version) continue;

        const wholeVersionMarked = el.hasAttribute('data-popup');
        const lis = [...el.querySelectorAll('.change-list li')];
        const picked = wholeVersionMarked ? lis : lis.filter((li) => li.hasAttribute('data-popup'));
        if (picked.length === 0) continue;   // 지정된 것이 없는 버전은 팝업에 안 나옴

        entries.push({
            version,
            date: (el.querySelector('.version-date')?.textContent || '').trim(),
            title: (el.querySelector('.version-title')?.textContent || '').trim(),
            // textContent → 태그 제거 + 엔티티 디코드. 줄바꿈·중복 공백은 한 칸으로.
            items: picked.map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
        });
    }

    // data-popup이 하나도 없는 것은 정상이다 — 중요하지 않은 릴리스가 빌드를 막아선 안 된다.
    const payload = { generatedFor: appVersion, entries };

    const banner =
        '// 이 파일은 scripts/extract-whatsnew.js가 생성합니다. 직접 수정하지 마세요.\n' +
        '// 내용을 바꾸려면 src/release/index.html의 data-popup 표시를 고치고 다시 빌드하세요.\n' +
        '// 생성 근거: SLS-1-218\n';

    fs.writeFileSync(
        OUT_FILE,
        `${banner}window.WHATS_NEW = ${JSON.stringify(payload, null, 4)};\n`,
        'utf8'
    );

    const total = entries.reduce((n, e) => n + e.items.length, 0);
    console.log(`[extract-whatsnew] ${appVersion} 기준 — 버전 ${entries.length}건 / 항목 ${total}건`);
    if (entries.length === 0) {
        console.log('  data-popup 표시가 없어 팝업은 뜨지 않습니다 (정상).');
    }
}

main();
