import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-216: 동기화 버튼이 막다른 길이던 문제 + 남은 클라우드 문구 정리
//
// 버튼을 누르면 main-init.js:112가 "설정 페이지에서 인증 파일을 등록해주세요"라고
// 안내하는데, 그 authFileSection(settings/index.html:468)은 SLS-1-190·191에서
// display:none으로 숨겨졌다. 시키는 대로 따라가도 등록할 곳이 없었다.
//
// ⚠️ 무조건 숨김이 아니라 **조건부 노출**이다.
//    v1.10.14가 "클라우드 연동을 이미 설정해 쓰고 계신 소수 사용자는 관련 기능과
//    자동 동기화가 기존과 동일하게 계속 동작합니다"라고 약속했다(release/index.html).
//    신규 설정은 불가능하므로 사실상 전원에게 숨겨지지만, 옛 사용자에겐 남는다.
//
// ⚠️ 5번이 이 파일의 핵심이다. 4번만 있으면 "클라우드 문구 전부 삭제"로도 통과해
//    옛 사용자용 조건부 안내까지 사라진다. firebase-name-exposure.test.js 4·5번과 같은 취지.

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

const INDEX = read('src/index.html')
const MAIN_INIT = read('src/shared/main-init.js')
const SETTINGS = read('src/settings/index.html')

describe('동기화 버튼 노출 조건', () => {
    it('1. 기본값이 숨김이다', () => {
        const btn = INDEX.match(/<button[^>]*id="syncBtn"[^>]*>/)
        expect(btn, '#syncBtn을 찾지 못했다').toBeTruthy()
        expect(btn[0], `실제: ${btn?.[0]}`).toMatch(/style="[^"]*display:\s*none/)
    })

    it('2. 클라우드 모드 블록 안에서만 노출한다', () => {
        // mode === 'cloud' 분기의 본문을 떼어내 그 안에 노출 코드가 있는지 본다.
        // 파일 전체에서 찾으면 분기 밖으로 옮겨져도 통과한다.
        const branch = MAIN_INIT.match(/if \(mode === 'cloud'\) \{([\s\S]*?)\n\s{8}\}/)
        expect(branch, "mode === 'cloud' 분기를 찾지 못했다").toBeTruthy()
        expect(branch[1], '분기 안에서 syncBtn을 노출하지 않는다').toContain('syncBtn')
    })

    it('3. 노출 값이 .sync-btn의 CSS display와 같다', () => {
        // block으로 되돌리면 아이콘·라벨 정렬이 깨진다
        const css = INDEX.match(/\.sync-btn\s*\{([\s\S]*?)\}/)
        expect(css, '.sync-btn 규칙을 찾지 못했다').toBeTruthy()
        const cssDisplay = css[1].match(/display:\s*([a-z-]+)/)?.[1]
        expect(cssDisplay, '.sync-btn에 display가 없다').toBeTruthy()

        const shown = MAIN_INIT.match(/syncBtn'\)\?\.style\.setProperty\('display',\s*'([a-z-]+)'\)/)
        expect(shown, 'syncBtn 노출 코드를 찾지 못했다').toBeTruthy()
        expect(shown[1], `CSS는 ${cssDisplay}인데 노출은 ${shown?.[1]}`).toBe(cssDisplay)
    })

    it('4. 모듈이 문법적으로 유효하다', async () => {
        // 🚨 플랜 초안이 `syncStatusEl?.style.display = 'block'`을 지시했다 —
        //    옵셔널 체이닝은 대입식 좌변에 쓸 수 없어 SyntaxError다.
        //    main-init.js는 단일 ES 모듈이라 파싱이 깨지면 파일 전체 기능이 죽는다.
        await expect(import('../../src/shared/main-init.js')).resolves.toBeDefined()
    })
})

describe('설정 화면 클라우드 문구', () => {
    /** 보이는 카드만 — display:none 카드 내부는 대상이 아니다 */
    const 무조건적_금지 = [
        ['이 기기(localStorage), 클라우드', '연도별 삭제 안내가 클라우드를 무조건 나열한다'],
        ['로컬(및 클라우드)에 보관', '작물 데이터 안내가 클라우드를 무조건 나열한다'],
    ]

    it('5. 무조건적 클라우드 서술이 없다', () => {
        무조건적_금지.forEach(([needle, why]) => {
            expect(SETTINGS, why).not.toContain(needle)
        })
    })

    // 🚨 과잉 삭제 방어 — 이 단언이 없으면 "클라우드 전부 지우기"로도 5번이 통과한다.
    //    조건부 서술은 참이고, 옛 클라우드 사용자에게 실제로 해당한다. 지우면 거짓이 된다.
    it('6. 조건부 서술은 남아 있다', () => {
        const 유지 = [
            ['클라우드를 사용 중이면', 'purgeYearData가 isEnabled() 뒤에서 실제로 클라우드를 지운다'],
            ['클라우드 연결 시 다른 PC에도', '작물 데이터는 클라우드 연결 시 실제로 동기화된다'],
            ['클라우드 연결 시에만 다른 기기와', '웹 환경의 동기화 조건 설명'],
        ]
        유지.forEach(([needle, why]) => {
            expect(SETTINGS, `"${needle}"가 사라졌다 — ${why}`).toContain(needle)
        })
    })
})
