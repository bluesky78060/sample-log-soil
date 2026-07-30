import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

// SLS-1-218: 릴리스 노트 → 팝업 데이터 추출 스크립트
//
// ⚠️ 15번이 이 파일의 핵심이다. release/index.html의 li 안에는 <strong>뿐 아니라
//    <code>&lt;select …&gt;</code> 같은 코드 스니펫이 7개 버전 27곳에 있다.
//    정규식으로 <strong>만 걷어내는 구현이면 <code> 태그와 이스케이프된 &lt; 가
//    그대로 팝업에 노출된다. 플랜 리뷰가 MAJOR로 잡은 지점이다.
//
// 스크립트를 실제로 실행해 검증한다 — 소스 문자열 검색으로는 동작을 증명하지 못한다.

const ROOT = process.cwd()
const SCRIPT = resolve(ROOT, 'scripts/extract-whatsnew.js')

/**
 * 임시 프로젝트를 만들어 스크립트를 돌린다.
 * @returns {{code:number, stdout:string, stderr:string, out:string|null}}
 */
function runWith({ releaseHtml, version }) {
    const dir = mkdtempSync(join(tmpdir(), 'wn-'))
    mkdirSync(join(dir, 'src', 'release'), { recursive: true })
    mkdirSync(join(dir, 'src', 'shared'), { recursive: true })
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    cpSync(SCRIPT, join(dir, 'scripts', 'extract-whatsnew.js'))
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }), 'utf8')
    writeFileSync(join(dir, 'src', 'release', 'index.html'), releaseHtml, 'utf8')
    // jsdom을 찾도록 실제 node_modules를 심볼릭이 아닌 NODE_PATH로 연결한다
    let code = 0, stdout = '', stderr = ''
    try {
        stdout = execFileSync(process.execPath, [join(dir, 'scripts', 'extract-whatsnew.js')], {
            cwd: dir,
            encoding: 'utf8',
            env: { ...process.env, NODE_PATH: resolve(ROOT, 'node_modules') },
        })
    } catch (e) {
        code = e.status ?? 1
        stdout = e.stdout || ''
        stderr = e.stderr || ''
    }
    let out = null
    try {
        const raw = readFileSync(join(dir, 'src', 'shared', 'whatsnew-data.js'), 'utf8')
        out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    } catch { /* 생성 안 됨 */ }
    return { code, stdout, stderr, out }
}

const entry = (ver, { markVersion = false, marks = [], items }) => `
<div class="version-entry"${markVersion ? ' data-popup' : ''}>
  <div class="version-meta">
    <span class="version-number">v${ver}</span>
    <span class="version-date">2026-07-29</span>
  </div>
  <div class="version-title">${ver} 제목</div>
  <ul class="change-list">
    ${items.map((t, i) => `<li${marks.includes(i) ? ' data-popup' : ''}>${t}</li>`).join('\n')}
  </ul>
</div>`

const page = (...entries) => `<html><body><div class="timeline">${entries.join('')}</div></body></html>`

describe('data-popup 표시 해석', () => {
    it('12. 표시 없는 버전은 제외된다', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(entry('1.14.3', { items: ['가', '나'] })),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.out.entries).toEqual([])
    })

    it('13. version-entry에 붙이면 모든 항목이 담긴다', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(entry('1.14.3', { markVersion: true, items: ['가', '나', '다'] })),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.out.entries[0].items).toEqual(['가', '나', '다'])
    })

    it('14. li에만 붙이면 그 항목만 담긴다', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(entry('1.14.3', { marks: [1], items: ['가', '나', '다'] })),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.out.entries[0].items).toEqual(['나'])
    })

    it('여러 버전이 각각 독립적으로 판정된다', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(
                entry('1.14.3', { markVersion: true, items: ['최신'] }),
                entry('1.12.0', { items: ['표시 없음'] }),
                entry('1.9.0', { marks: [0], items: ['옛것'] }),
            ),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.out.entries.map(e => e.version)).toEqual(['1.14.3', '1.9.0'])
    })
})

describe('태그·엔티티 처리', () => {
    // 🚨 플랜 리뷰 MAJOR 1 — 실제 릴리스 노트의 <code> 항목을 그대로 쓴다 (합성 금지)
    it('15. <code>와 이스케이프된 꺾쇠가 제거된다', () => {
        const real = readFileSync(resolve(ROOT, 'src/release/index.html'), 'utf8')
        // ⚠️ 초안은 /<li>[^]*?<code>[^]*?<\/li>/ 를 썼는데 **124개 li를 통째로 잡았다.**
        //    lazy라도 시작 위치가 파일의 첫 li여서 그 뒤 첫 </li>까지 늘어난다.
        //    그러면 items[0]에 <code>가 없어 정규식 파싱 뮤테이션이 살아남는다(실제로 살았다).
        //    → </li>를 건너뛰지 않는 하나의 li만 잡는다.
        const codeLi = real.match(/<li>((?:(?!<\/li>)[\s\S])*?<code>(?:(?!<\/li>)[\s\S])*?)<\/li>/)
        expect(codeLi, '실제 릴리스 노트에서 <code> 포함 li를 찾지 못했다').toBeTruthy()
        expect(codeLi[0].match(/<li>/g)?.length, 'li 하나만 잡아야 한다').toBe(1)

        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(`
<div class="version-entry" data-popup>
  <div class="version-number">v1.14.3</div>
  <div class="version-title">제목</div>
  <ul class="change-list">${codeLi[0]}</ul>
</div>`),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.out.entries[0].items).toHaveLength(1)
        // 항목 전체를 합쳐 본다 — 특정 인덱스만 보면 다른 항목에 남은 태그를 놓친다
        const text = r.out.entries[0].items.join(' ')
        for (const bad of ['<code>', '</code>', '<strong>', '&lt;', '&gt;', '&amp;']) {
            expect(text, `"${bad}"가 남았다 — 정규식 파싱을 쓴 것으로 보인다`).not.toContain(bad)
        }
        expect(text.length, '내용이 통째로 사라졌다').toBeGreaterThan(10)
    })

    it('줄바꿈과 중복 공백이 한 칸으로 정리된다', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(`
<div class="version-entry" data-popup>
  <div class="version-number">v1.14.3</div>
  <div class="version-title">제목</div>
  <ul class="change-list"><li>앞

     뒤</li></ul>
</div>`),
        })
        expect(r.out.entries[0].items[0]).toBe('앞 뒤')
    })
})

describe('실패 처리', () => {
    it('16. package.json 버전 항목이 릴리스 노트에 없으면 실패한다', () => {
        const r = runWith({
            version: '1.15.0',
            releaseHtml: page(entry('1.14.3', { markVersion: true, items: ['가'] })),
        })
        expect(r.code, '버전 누락인데 성공했다 — CLAUDE.md 규칙 강제가 무력하다').not.toBe(0)
        expect(r.stderr).toContain('1.15.0')
    })

    it('17. data-popup이 전혀 없어도 성공한다 (빈 entries)', () => {
        const r = runWith({
            version: '1.14.3',
            releaseHtml: page(entry('1.14.3', { items: ['가'] })),
        })
        expect(r.code, '중요하지 않은 릴리스가 빌드를 막아선 안 된다').toBe(0)
        expect(r.out.entries).toEqual([])
        expect(r.out.generatedFor).toBe('1.14.3')
    })

    it('version-entry가 하나도 없으면 실패한다 (구조 변경 감지)', () => {
        const r = runWith({ version: '1.14.3', releaseHtml: '<html><body>텅 빔</body></html>' })
        expect(r.code).not.toBe(0)
    })
})
