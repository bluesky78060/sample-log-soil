import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 인라인 스크립트 금지 — 설치본 CSP 가 막는다 (SLS-1-295)
 *
 * 설치본은 file:// 응답에 `script-src 'self' file:` 를 붙여 인라인 <script> 와 on*= 속성을 막는다.
 * 웹판·E2E(http-server)에는 그 헤더가 없어 릴리스 노트·Firebase 설정 안내의 죽은 버튼이 안 보였다.
 * 정규식이 아니라 DOM 으로 파싱한다 — `<script` 뒤 줄바꿈·`<SCRIPT>`·`data-src` 로 우회되고 본문 텍스트에 오탐한다.
 */

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'src')

/** src/ 아래 모든 .html (vite 입력이 아닌 것도 — 실수로 들어와도 같은 규칙을 따른다) */
function htmlFiles(dir) {
    const out = []
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) out.push(...htmlFiles(p))
        else if (e.name.endsWith('.html')) out.push(p)
    }
    return out
}

/** 실행되지 않는 데이터 블록 type — JSON-LD, 템플릿 등 */
// importmap 은 모듈 해석을 바꾸는 실행 블록이라 CSP 가 막는다 — 데이터 블록이 아니다
const INERT_TYPES = new Set(['application/json', 'application/ld+json', 'text/template', 'text/html'])

function findings(html) {
    const doc = new JSDOM(html).window.document
    const out = []
    for (const s of doc.querySelectorAll('script:not([src])')) {
        const type = (s.getAttribute('type') || '').trim().toLowerCase()
        if (!INERT_TYPES.has(type)) out.push(`인라인 <script>: ${s.textContent.trim().slice(0, 40).replace(/\s+/g, ' ')}…`)
    }
    for (const el of doc.querySelectorAll('*')) {
        for (const a of el.getAttributeNames()) {
            if (a.toLowerCase().startsWith('on')) out.push(`<${el.tagName.toLowerCase()} ${a}=…>`)
        }
    }
    for (const el of doc.querySelectorAll('[href], [src], [action], [formaction]')) {
        for (const a of ['href', 'src', 'action', 'formaction']) {
            if (/^\s*javascript:/i.test(el.getAttribute(a) || '')) out.push(`javascript: URL (${a})`)
        }
    }
    return out
}

describe('src/**/*.html — 인라인 스크립트·핸들러 없음', () => {
    const files = htmlFiles(SRC)

    it('대상 파일을 실제로 찾는다(공허하지 않다)', () => {
        expect(files.length).toBeGreaterThanOrEqual(10)
        expect(files.map((f) => path.relative(SRC, f))).toEqual(
            expect.arrayContaining(['release/index.html', 'manual/firebase-setup.html', 'index.html']),
        )
    })

    it.each(files.map((f) => [path.relative(SRC, f), f]))('%s', (_rel, file) => {
        expect(findings(fs.readFileSync(file, 'utf8'))).toEqual([])
    })
})

describe('검사기 자체 — 우회 형태를 잡는다', () => {
    it.each([
        ['줄바꿈이 낀 <script', '<body><script\n>alert(1)</script></body>'],
        ['대문자 <SCRIPT>', '<body><SCRIPT>alert(1)</SCRIPT></body>'],
        ['data-src 로 위장', '<body><script data-src="x">alert(1)</script></body>'],
        ['onclick 속성', '<body><div onclick="f()">x</div></body>'],
        ['대문자 ONCLICK', '<body><div ONCLICK="f()">x</div></body>'],
        ['onerror 속성', '<body><img src="x" onerror="f()"></body>'],
        ['javascript: URL', '<body><a href="javascript:void(0)">x</a></body>'],
        ['공백 낀 javascript:', '<body><a href="  JavaScript:f()">x</a></body>'],
        ['importmap 인라인 블록', '<body><script type="importmap">{"imports":{}}</script></body>'],
        ['javascript: formaction', '<body><form><button formaction="javascript:f()">x</button></form></body>'],
    ])('%s', (_label, html) => {
        expect(findings(html).length).toBeGreaterThan(0)
    })

    it.each([
        ['외부 모듈', '<body><script type="module" src="./a.js"></script></body>'],
        ['JSON 데이터 블록', '<body><script type="application/json">{"a":1}</script></body>'],
        ['본문 텍스트 속 onclick= 표기', '<body><p>예: onclick="f()" 는 쓰지 않는다</p></body>'],
        ['data-action 속성', '<body><div data-action="x">x</div></body>'],
        ['일반 formaction', '<body><form><button formaction="/submit">x</button></form></body>'],
        ['일반 링크', '<body><a href="https://example.com">x</a></body>'],
    ])('오탐하지 않는다: %s', (_label, html) => {
        expect(findings(html)).toEqual([])
    })
})

// innerHTML·템플릿 문자열 안의 `onclick="…"` 도 CSP 에 막힌다. 이름 목록 방식이라 `onClick`(대소문자)·`onbeforeunload`·따옴표 없는
// `onclick=f()` 등은 놓친다 — `\son[a-z]+=` 는 `const online = …` 에 오탐해 목록으로 바꿨다. 필요하면 목록을 늘린다.
const HANDLERS =
    'click|dblclick|change|input|submit|load|error|focus|blur|select|toggle|scroll|wheel|resize|unload|message|hashchange|' +
    'copy|cut|paste|contextmenu|key[a-z]+|mouse[a-z]+|pointer[a-z]+|touch[a-z]+|drag[a-z]*|drop|animation[a-z]+|transition[a-z]+'
const INLINE_HANDLER = new RegExp(`\\son(?:${HANDLERS})\\s*=\\s*["'\`\\\\]`)

describe('src/**/*.js — 인라인 핸들러 문자열 없음', () => {
    it('목록 밖의 흔한 핸들러도 잡고 변수 대입은 오탐하지 않는다 (모든 on* 을 잡지는 않는다)', () => {
        for (const h of ['onpointerdown', 'ontouchstart', 'onanimationend', 'ondragover', 'oncontextmenu']) {
            expect(INLINE_HANDLER.test(`x.innerHTML = '<div ${h}="f()">x</div>'`), h).toBe(true)
        }
        expect(INLINE_HANDLER.test('const online = "yes"')).toBe(false)
        expect(INLINE_HANDLER.test('const one = "1"')).toBe(false)
    })

    function jsFiles(dir) {
        const out = []
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name)
            if (e.isDirectory()) out.push(...jsFiles(p))
            else if (e.name.endsWith('.js') && !e.name.endsWith('.min.js')) out.push(p)
        }
        return out
    }

    it('JS 안에 인라인 이벤트 핸들러 마크업이 없다', () => {
        const bad = []
        for (const f of jsFiles(SRC)) {
            const lines = fs.readFileSync(f, 'utf8').split('\n')
            lines.forEach((l, i) => {
                // 주석에 적힌 설명(`// onclick="…" 금지`)은 제외
                if (INLINE_HANDLER.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l)) bad.push(`${path.relative(ROOT, f)}:${i + 1}`)
            })
        }
        expect(bad).toEqual([])
    })
})
