#!/usr/bin/env node
/**
 * 토양 가져오기 기본 서식(.xlsx)을 base64 모듈로 내장한다 (SLS-1-232).
 *
 * ⚠️ **왜 파일을 그대로 내장하나**: 서식을 코드로 생성하면 셀 색·테두리·병합이
 *    전혀 나오지 않는다. soil-entry.js가 스타일 미지원 xlsx(SheetJS CE)를 쓰기 때문이다.
 *    사용자가 만든 업무 서식은 그 꾸밈이 본질이라, 바이트를 그대로 내려줘야 한다.
 *
 * ⚠️ **왜 base64인가**: Electron은 `file://` 오리진이라 상대 경로 자산을 fetch로 못 읽는다.
 *    모듈에 담아 두면 두 환경(Electron / 웹)에서 같은 방식으로 동작한다.
 *
 * 산출물은 **커밋 대상**이다 (whatsnew-data.js와 같은 방식).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SRC = path.join(__dirname, '..', 'src', 'assets', 'soil-import-template.xlsx');
const OUT = path.join(__dirname, '..', 'src', 'shared', 'soil-template-data.js');
const DOWNLOAD_NAME = '토양_기본서식.xlsx';

function build() {
    const buf = fs.readFileSync(SRC);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    const body = `// 자동 생성 — 직접 고치지 마십시오. (scripts/embed-soil-template.js)
//
// 원본: src/assets/soil-import-template.xlsx
// 서식을 코드로 다시 만들지 않고 **바이트 그대로** 담는다 — 셀 색·테두리·병합을
// 지키려면 이 방법뿐이다(soil-entry.js의 xlsx는 스타일을 쓰지 못한다).
window.SOIL_TEMPLATE = {
    fileName: ${JSON.stringify(DOWNLOAD_NAME)},
    bytes: ${buf.length},
    sha256: ${JSON.stringify(sha256)},
    base64: ${JSON.stringify(buf.toString('base64'))},
};
`;
    return { body, sha256, bytes: buf.length };
}

if (require.main === module) {
    if (!fs.existsSync(SRC)) {
        console.error(`[embed-soil-template] 원본이 없습니다: ${SRC}`);
        process.exit(1);
    }
    const { body, sha256, bytes } = build();
    fs.writeFileSync(OUT, body, 'utf8');
    console.log(`[embed-soil-template] ${bytes.toLocaleString()}바이트 · sha256 ${sha256.slice(0, 12)}…`);
}

module.exports = { build, SRC, OUT, DOWNLOAD_NAME };
