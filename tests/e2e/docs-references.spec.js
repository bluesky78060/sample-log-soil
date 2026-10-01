// @ts-check
// 빌드 산출물(docs/)의 무결성 — HTML 이 가리키는 로컬 파일이 모두 있는가 (SLS-1-295)
//
// docs/ 는 GitHub Pages 가 서빙하고 설치본이 file:// 로 로드한다. 청크 이름에 해시가 붙어 있어,
// `git checkout -- docs/<파일>` 로 일부만 되돌리거나 부분 빌드를 하면 HTML 이 **이미 없는 옛 청크**를
// 가리키는데 아무 테스트도 깨지지 않는다.
// 브라우저가 필요 없어 빠르다.
//
// ⚠️ docs/ 빌드 산출물을 대상으로 돈다 — `npm run build` 먼저.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const DOCS = path.join(__dirname, '..', '..', 'docs');

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return htmlFiles(p);
        return e.name.endsWith('.html') ? [p] : [];
    });
}

/** 상대 경로(`./` `../`) 참조만 — 외부 URL·앵커·절대경로는 제외. 따옴표 종류와 `=` 주변 공백을 가리지 않고 srcset·poster·인라인 style 의 url() 도 본다 */
function localRefs(/** @type {string} */ html) {
    const out = [];
    for (const m of html.matchAll(/\b(?:src|href|poster|data-src)\s*=\s*["'](\.[^"'#?]+)["']/g)) out.push(m[1]);
    for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/g)) {
        for (const part of m[1].split(',')) {
            const url = part.trim().split(/\s+/)[0];
            if (url.startsWith('.')) out.push(url);
        }
    }
    for (const m of html.matchAll(/url\(\s*["']?(\.[^"')#?]+)/g)) out.push(m[1]);
    return out;
}

test.describe('docs/ 참조 무결성 (SLS-1-295)', () => {
    const files = htmlFiles(DOCS);

    test('검사 대상을 실제로 찾는다(공허하지 않다)', () => {
        expect(files.length).toBeGreaterThanOrEqual(10);
        const total = files.reduce((n, f) => n + localRefs(fs.readFileSync(f, 'utf8')).length, 0);
        expect(total).toBeGreaterThan(50);
    });

    test('HTML 이 가리키는 로컬 파일이 모두 존재한다', () => {
        /** @type {string[]} */
        const missing = [];
        for (const f of files) {
            for (const ref of localRefs(fs.readFileSync(f, 'utf8'))) {
                if (!fs.existsSync(path.resolve(path.dirname(f), ref))) {
                    missing.push(`${path.relative(DOCS, f)} → ${ref}`);
                }
            }
        }
        expect(missing, '없는 파일을 가리키는 참조').toEqual([]);
    });

    test('검사기 자체 — 따옴표·공백·srcset·url() 형태를 잡는다', () => {
        expect(localRefs(`<script src='./a.js'></script>`)).toEqual(['./a.js']);
        expect(localRefs(`<script src = "../b.js"></script>`)).toEqual(['../b.js']);
        expect(localRefs(`<img srcset="./c.webp 1x, ./d.webp 2x">`)).toEqual(['./c.webp', './d.webp']);
        expect(localRefs(`<style>.x{background:url("./e.png")}</style>`)).toEqual(['./e.png']);
        expect(localRefs(`<a href="https://x.test/a.js"></a><a href="#top"></a><a href="/abs.js"></a>`)).toEqual([]);
    });

    test('JS 청크가 import 하는 상대 청크도 모두 존재한다', () => {
        const assets = path.join(DOCS, 'assets');
        /** @type {string[]} */
        const missing = [];
        for (const name of fs.readdirSync(assets).filter((f) => f.endsWith('.js'))) {
            const src = fs.readFileSync(path.join(assets, name), 'utf8');
            for (const m of src.matchAll(/(?:import|from)\s*\(?\s*["']\.\/([A-Za-z0-9._-]+\.js)["']/g)) {
                if (!fs.existsSync(path.join(assets, m[1]))) missing.push(`${name} → ./${m[1]}`);
            }
        }
        expect(missing, '없는 청크를 import 하는 청크').toEqual([]);
    });
});
