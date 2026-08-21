import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
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

// ⚠️ SLS-1-269: 예전에는 **테스트마다 자식 프로세스를 띄웠다.**
//    실측 — node 기동 23ms, jsdom 로드 235ms, 테스트 1건 300~380ms.
//    비용의 75%가 jsdom 모듈 로드였고 그것을 9번 다시 지불했다. E2E와 겹쳐 CPU가
//    경합하면 5초 벽을 넘어 **무작위로 2~6건이 실패**했다.
//    이제 대부분을 같은 프로세스에서 함수로 부른다. 모듈 로드가 1회로 준다.
//    (`new JSDOM()`과 HTML 파싱은 호출마다 그대로 일어난다 — 줄어드는 것은 모듈 로드다.)
//
// ⚠️ CLI 계약은 프로세스 테스트 2건으로 따로 지킨다 (아래 '실패 처리' describe).
//    require.main 분기·종료 코드·shebang은 함수 호출로는 증명되지 않는다.
const { extract } = createRequire(import.meta.url)(SCRIPT)

/** 임시 프로젝트 디렉터리를 만든다 (파일에서 읽는다는 계약은 그대로 둔다) */
function makeFixture({ releaseHtml, version }) {
    const dir = mkdtempSync(join(tmpdir(), 'wn-'))
    mkdirSync(join(dir, 'src', 'release'), { recursive: true })
    mkdirSync(join(dir, 'src', 'shared'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version }), 'utf8')
    writeFileSync(join(dir, 'src', 'release', 'index.html'), releaseHtml, 'utf8')
    return dir
}

function readOut(dir) {
    try {
        const raw = readFileSync(join(dir, 'src', 'shared', 'whatsnew-data.js'), 'utf8')
        return JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
    } catch { return null }   // 생성 안 됨
}

/**
 * 같은 프로세스에서 extract()를 부른다.
 * @returns {{code:number, stderr:string, out:object|null, result:object}}
 *          code/stderr는 기존 단언을 그대로 쓰기 위한 어댑터다.
 */
function runWith({ releaseHtml, version }) {
    const dir = makeFixture({ releaseHtml, version })
    const result = extract(dir)
    return {
        code: result.ok ? 0 : 1,
        stderr: result.ok ? '' : [result.error, ...result.detail].join('\n'),
        out: readOut(dir),
        result,
    }
}

/** 실제 자식 프로세스로 CLI를 돌린다 (CLI 계약 전용) */
function runCli({ releaseHtml, version }) {
    const dir = makeFixture({ releaseHtml, version })
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    cpSync(SCRIPT, join(dir, 'scripts', 'extract-whatsnew.js'))
    let code = 0, stdout = '', stderr = ''
    try {
        // jsdom을 찾도록 실제 node_modules를 NODE_PATH로 연결한다
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
    return { code, stdout, stderr, out: readOut(dir) }
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
    it('16. package.json 버전 항목이 릴리스 노트에 없으면 빌드가 실패한다 (CLI)', () => {
        // ⚠️ 이 한 건은 **반드시 자식 프로세스로** 돌린다 (SLS-1-269).
        //    CLAUDE.md의 "릴리스 노트 먼저 추가" 규약을 기계적으로 강제하는 것은
        //    `npm run build`가 보는 **종료 코드**다. 함수 반환값으로는 그 계약이 증명되지 않는다.
        const r = runCli({
            version: '1.15.0',
            releaseHtml: page(entry('1.14.3', { markVersion: true, items: ['가'] })),
        })
        expect(r.code, '버전 누락인데 성공했다 — CLAUDE.md 규칙 강제가 무력하다').not.toBe(0)
        // stderr 3줄 계약 — 사용자가 무엇을 해야 하는지가 실제로 출력돼야 한다
        expect(r.stderr).toContain('1.15.0')
        expect(r.stderr).toContain('src/release/index.html')
        expect(r.stderr).toContain('1.14.3')          // 릴리스 노트의 최신 버전 안내
        expect(r.out, '실패했는데 산출물이 만들어졌다').toBeNull()
    }, 20000)

    it('16-b. 정상 입력이면 CLI가 종료 코드 0으로 산출물을 만든다', () => {
        // 실패 경로만 프로세스로 보면 "CLI가 아예 안 도는" 회귀를 놓친다.
        const r = runCli({
            version: '1.14.3',
            releaseHtml: page(entry('1.14.3', { markVersion: true, items: ['가'] })),
        })
        expect(r.code, r.stderr).toBe(0)
        expect(r.stdout).toContain('1.14.3')
        expect(r.out.entries[0].items).toEqual(['가'])
    }, 20000)

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
        // CLI가 그대로 찍어 낼 문구다 — 함수 반환 계약을 여기서 고정한다
        expect(r.result.error).toContain('.version-entry')
        expect(r.result.detail.join(' ')).toContain('index.html')
        expect(r.out, '실패했는데 산출물이 만들어졌다').toBeNull()
    })

    it('18. require만 해도 저장소 파일을 건드리지 않는다 (SLS-1-269)', () => {
        // ⚠️ `if (require.main === module)` 가드가 없으면 이 테스트 파일이 스크립트를
        //    require하는 순간 **저장소의 src/shared/whatsnew-data.js가 덮어써진다.**
        //    실제로 가드를 빼고 돌려 보니 파일이 조용히 바뀌었고 **10건 전부 통과했다.**
        //    아무도 못 잡는 사고라 여기서 명시적으로 막는다.
        //
        //    이 프로세스는 이미 스크립트를 require한 뒤라 여기서 관찰할 수 없다.
        //    → 자식 프로세스에서 require만 시키고 파일이 그대로인지 본다.
        //    ⚠️ **내용 비교로는 못 잡는다.** 재생성해도 결과가 같아서 문자열이 일치한다.
        //       실제로 내용만 비교했을 때 변이가 살아남았다. **수정 시각**을 봐야 한다.
        const target = resolve(ROOT, 'src/shared/whatsnew-data.js')
        //    밀리초로 보면 같은 밀리초 안의 재작성을 놓칠 수 있어 **나노초**로 본다.
        const mtimeNs = () => statSync(target, { bigint: true }).mtimeNs
        const before = mtimeNs()
        const beforeText = readFileSync(target, 'utf8')
        execFileSync(process.execPath, ['-e', `require(${JSON.stringify(SCRIPT)})`], {
            cwd: ROOT,
            encoding: 'utf8',
        })
        expect(mtimeNs(),
            'require만 했는데 산출물이 다시 쓰였다 — require.main 가드가 빠졌다').toBe(before)
        expect(readFileSync(target, 'utf8')).toBe(beforeText)
    }, 20000)
})
