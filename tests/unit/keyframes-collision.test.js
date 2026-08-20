import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// SLS-1-263: 페이지 CSS가 공용 @keyframes를 덮어써 페이지 전체가 확대됐다
//
// 🚨 이 파일이 막는 것:
//    `@keyframes` 이름에는 **스코프가 없다.** 파일을 나눠도 전역이고, 나중에
//    로드되는 정의가 앞의 것을 통째로 대체한다. 선택자와 달리 특이도도, 경고도 없다.
//
//    실제로 soil-style.css가 작은 배지용으로 만든 `fadeIn`(scale 0.8 → 1)이
//    공용 style.css의 `fadeIn`(translateY)을 덮어써, **토양 페이지에서 화면을
//    전환할 때마다 전체가 80%에서 확대**됐다. 배지 하나에 어울리는 효과가
//    페이지 전환에 걸린 것이다.
//
//    눈에는 "잠깐 커지며 나타난다" 정도라 아무도 결함으로 신고하지 않았다.
//    발견은 엉뚱한 데서 났다 — SLS-1-260/261에서 고정 열 좌표를 재는데 값이
//    계속 어긋났고, 0.3초 동안 모든 요소가 0.844배로 찍히고 있었다.
//    **화면을 재는 코드에는 치명적**이다.
//
// ⚠️ 검사 대상은 **공용 style.css와 함께 로드되는 페이지 CSS**뿐이다.
//    src/index.html 같은 독립 페이지는 style.css를 아예 부르지 않아 겹칠 수 없다
//    (2026-08-20 확인: index/settings/feedback/feedback-admin 모두 링크 0건).
const SRC = join(process.cwd(), 'src')
const SHARED = join(SRC, 'style.css')

/** 이름이 아니라 값에 섞여 나오는 CSS 키워드들 — 애니메이션 이름 후보에서 뺀다 */
const ANIM_KEYWORDS = new Set([
    'normal', 'reverse', 'alternate', 'none', 'forwards', 'backwards', 'both',
    'running', 'paused', 'infinite', 'linear', 'ease', 'ease-in', 'ease-out',
    'ease-in-out', 'step-start', 'step-end', 'steps', 'cubic-bezier',
    'initial', 'inherit', 'unset', 'revert',
])

const keyframeNames = (file) => {
    const names = [...readFileSync(file, 'utf8').matchAll(/@keyframes\s+([A-Za-z0-9_-]+)/g)]
        .map((m) => m[1])
    return new Set(names)
}

/** 그 파일이 `animation`/`animation-name`으로 **참조하는** 이름들 */
const animationRefs = (file) => {
    const src = readFileSync(file, 'utf8')
    const refs = new Set()
    for (const m of src.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
        const tokens = [...m[1].matchAll(/[A-Za-z_][A-Za-z0-9_-]*/g)].map((t) => t[0])
            .filter((t) => !ANIM_KEYWORDS.has(t))
        if (tokens.length) refs.add(tokens.join('|'))   // 후보 묶음 (하나만 맞으면 된다)
    }
    return refs
}

/** src 아래 모든 .css (공용·빌드 산출물 제외) */
function pageStylesheets(dir = SRC, out = []) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) { pageStylesheets(p, out); continue }
        if (!name.endsWith('.css')) continue
        if (p === SHARED) continue
        if (name.includes('tailwind')) continue      // 빌드 산출물
        out.push(p)
    }
    return out
}

describe('@keyframes 이름 충돌 (SLS-1-263)', () => {
    const shared = keyframeNames(SHARED)
    const pages = pageStylesheets()

    it('검사 대상을 실제로 찾았다', () => {
        // 경로 규칙이 바뀌어 0건을 검사하면서 통과하는 것을 막는다
        expect(pages.length, '페이지 CSS를 못 찾았다').toBeGreaterThan(1)
        // 개수만 세면 공용 fadeIn이 사라지거나 이름이 바뀌어도 통과한다.
        // 이 사건의 당사자를 직접 짚는다.
        expect(shared.has('fadeIn'), '공용 style.css에 fadeIn이 없다 — '
            + '.view 전환 효과가 사라졌거나 이름이 바뀌었다').toBe(true)
    })

    // codex 리뷰(2026-08-20): 정의 충돌만 보면 **참조가 끊긴 것**은 못 잡는다.
    // 배지 선언이 실수로 다시 `animation: fadeIn`이 되면 이 사건이 그대로 재현되는데,
    // soil-style.css에 fadeIn 정의가 없으니 위 검사는 통과해 버린다.
    it.each(pageStylesheets().map((p) => relative(process.cwd(), p)))(
        '%s 가 참조하는 애니메이션이 실제로 정의돼 있다',
        (rel) => {
            const file = join(process.cwd(), rel)
            // 그 페이지에서 쓸 수 있는 정의: 자기 자신 + 공용 + tailwind(함께 로드됨)
            const defined = new Set([
                ...keyframeNames(file),
                ...shared,
                ...keyframeNames(join(SRC, 'shared', 'tailwind-output.css')),
            ])
            const missing = [...animationRefs(file)]
                .filter((cand) => !cand.split('|').some((n) => defined.has(n)))
            expect(missing, `정의가 없는 애니메이션을 참조한다: ${missing.join(', ')}\n`
                + '  → 이름을 바꾸면서 참조를 안 고쳤거나 오타다. 효과가 조용히 사라진다.')
                .toEqual([])
        })

    it('선택 개수 배지는 전용 효과(badgePopIn)를 쓴다', () => {
        // 이 사건의 재발 지점을 직접 못박는다 — 배지가 다시 공용 이름을 쓰면 실패한다.
        const soil = readFileSync(join(SRC, 'soil', 'soil-style.css'), 'utf8')
        const badge = soil.match(/\.selected-count-badge\s*\{[^}]*\}/)
        expect(badge, '.selected-count-badge 규칙을 못 찾았다').not.toBeNull()
        expect(badge[0], '배지가 공용 이름을 다시 쓰고 있다').toMatch(/animation:\s*badgePopIn/)
        expect(keyframeNames(join(SRC, 'soil', 'soil-style.css')).has('badgePopIn'),
            'badgePopIn 정의가 없다').toBe(true)
    })

    it.each(pageStylesheets().map((p) => relative(process.cwd(), p)))(
        '%s 가 공용 @keyframes를 덮어쓰지 않는다',
        (rel) => {
            const dup = [...keyframeNames(join(process.cwd(), rel))].filter((n) => shared.has(n))
            expect(dup, `공용 style.css의 @keyframes를 덮어쓴다: ${dup.join(', ')}\n`
                + '  → 이름은 전역이라 이 정의가 공용 것을 페이지 전체에서 대체한다.\n'
                + '  → 페이지 전용 효과면 이름을 따로 지어라 (예: badgePopIn).')
                .toEqual([])
        })
})
