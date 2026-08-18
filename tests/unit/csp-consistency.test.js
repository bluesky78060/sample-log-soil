import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// SLS-1-251: CSP가 두 곳에 있고 어긋나도 아무도 몰랐다
//
// 🚨 이 파일이 막는 것:
//    CSP는 **두 겹**으로 걸린다.
//      ① 각 페이지의 <meta http-equiv="Content-Security-Policy">  — 모든 환경
//      ② src/index.js의 onHeadersReceived 응답 헤더            — Electron의 file://
//    브라우저는 **둘 다** 만족해야 요청을 허용한다. 그래서 meta에만 오리진을 추가하면
//    웹에서는 되는데 Electron에서만 조용히 막힌다.
//
//    SLS-1-250이 정확히 그랬다. 관리자 페이지 meta에만 api.github.com을 넣었고,
//    사용자 화면에는 "Failed to fetch"만 떴다. 로컬 http 서버에서는 멀쩡했다.
//
// ⚠️ Electron을 실행하지 않는다 — 이 저장소에 Electron E2E 인프라가 없다.
//    **소스 텍스트를 파싱해 설정이 어긋났는지**만 본다. 그래도 이 결함은 정확히 잡는다.

// ⚠️ import.meta.url로 풀지 않는다 — vitest의 jsdom 환경에서는 문서 URL 기준이라
//    '/src/index.js' 같은 엉뚱한 경로가 나온다. vitest는 프로젝트 루트에서 실행된다.
const SRC = join(process.cwd(), 'src')

/**
 * connect-src 지시어에서 오리진 목록을 뽑는다.
 * ⚠️ 중복 지시어가 있으면 **첫 번째만** 본다 — CSP 규격상 브라우저도 첫 번째를 쓴다.
 */
function connectSrcOf(csp) {
    const m = csp.match(/connect-src([^;"]*)/)
    if (!m) return null
    return m[1].split(/\s+/).map((s) => s.trim()).filter(Boolean)
}

/** src/index.js의 응답 헤더 CSP (Electron file:// 전용) */
function headerConnectSrc() {
    const js = readFileSync(join(SRC, 'index.js'), 'utf8')
    // "connect-src 'self' https://... ; " 형태의 문자열 리터럴
    const m = js.match(/"connect-src[^"]*"/)
    expect(m, 'src/index.js에서 헤더 CSP의 connect-src를 못 찾았다 — 형태가 바뀌었다').toBeTruthy()
    const list = connectSrcOf(m[0])
    // 🚨 엉뚱한 문자열을 읽고도 조용히 통과하지 않게 못박는다.
    //    헤더 CSP가 템플릿 문자열/변수로 바뀌면 여기서 걸린다.
    expect(list, '헤더 CSP를 잘못 읽었다 — Firestore 오리진이 없다')
        .toContain('https://firestore.googleapis.com')
    return list
}

/**
 * src/**\/*.html 의 meta CSP 전부.
 * ⚠️ 한 파일에 meta가 여러 개일 수 있어 matchAll을 쓴다. 속성 순서·따옴표·대소문자도 흘린다.
 */
const META_RE = /<meta\b[^>]*http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi
const CONTENT_RE = /content=["]([^"]*)["]|content=[']([^']*)[']/i

function metaCsps() {
    const out = []
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const p = join(dir, name)
            if (statSync(p).isDirectory()) {
                if (name === 'node_modules' || name.startsWith('.')) continue
                walk(p)
            } else if (name.endsWith('.html')) {
                const html = readFileSync(p, 'utf8')
                for (const tag of html.matchAll(META_RE)) {
                    const c = tag[0].match(CONTENT_RE)
                    if (c) out.push({ file: relative(SRC, p), csp: c[1] ?? c[2] })
                }
            }
        }
    }
    walk(SRC)
    return out
}

/**
 * 헤더가 이 오리진을 허용하는가.
 * 완전 일치 외에 `https://*.googleapis.com` 같은 와일드카드도 인정한다 —
 * 안 그러면 실제로는 허용되는데 테스트만 빨개진다.
 */
function headerAllows(header, origin) {
    if (header.includes(origin)) return true
    return header.some((h) => {
        if (!h.includes('*')) return false
        const re = new RegExp(`^${h.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`)
        return re.test(origin)
    })
}

// ⚠️ 이 파일이 검사하는 것은 **connect-src 하나뿐**이다 (코드리뷰 지적).
//    script-src·style-src·font-src 등의 불일치는 잡지 못한다 — 그쪽은 페이지마다
//    의도적으로 다를 수 있어 일괄 비교가 오히려 소음이 된다.
//    이름과 주석이 실제보다 넓게 광고하지 않도록 여기에 못박아 둔다.
describe('CSP 두 겹의 connect-src가 어긋나지 않는다 (SLS-1-251)', () => {
    it('1. 헤더 CSP를 읽을 수 있다', () => {
        const list = headerConnectSrc()
        expect(list, 'connect-src를 못 읽었다').toBeTruthy()
        expect(list, "'self'가 빠졌다").toContain("'self'")
    })

    it('2. 검사 대상 페이지를 충분히 찾았다', () => {
        const pages = metaCsps()
        // 🚨 파서가 조용히 망가지면 "검사할 게 없어서" 통과한다.
        //    현재 10개다 — 아래로 크게 떨어지면 파서가 흘리고 있다는 뜻이다.
        expect(pages.length, `meta CSP 페이지를 ${pages.length}개만 찾았다 — 파서가 흘리고 있다`)
            .toBeGreaterThanOrEqual(8)
    })

    // ══════════════════════════════════════════════════════════════
    // 🚨 이 파일의 존재 이유
    //    페이지 meta에만 오리진을 추가하면 Electron에서 조용히 막힌다.
    // ══════════════════════════════════════════════════════════════
    it('3. meta에 있는 외부 오리진은 헤더 CSP에도 있다', () => {
        const header = headerConnectSrc()
        const missing = []

        for (const { file, csp } of metaCsps()) {
            const list = connectSrcOf(csp)
            if (!list) continue
            for (const origin of list) {
                // 키워드('self' 등)와 로컬 스킴은 비교 대상이 아니다
                if (!origin.startsWith('http')) continue
                if (!headerAllows(header, origin)) missing.push(`${file}: ${origin}`)
            }
        }

        expect(missing, [
            'meta CSP에는 있는데 src/index.js 헤더 CSP에 없는 오리진이 있다.',
            '웹에서는 동작하지만 **Electron에서만 조용히 차단**된다.',
            'src/index.js의 connect-src에도 같은 오리진을 추가하라.',
            '',
            ...missing,
        ].join('\n')).toEqual([])
    })

    // 이번 결함을 이름으로 못박는다 — 위 3번이 일반 규칙, 이건 회귀 표식
    it('4. api.github.com이 양쪽 모두에 있다 (SLS-1-250 회귀)', () => {
        const admin = metaCsps().find((p) => p.file.includes('feedback-admin'))
        expect(admin, '관리자 페이지를 못 찾았다').toBeTruthy()
        expect(connectSrcOf(admin.csp), '관리자 meta에 없다').toContain('https://api.github.com')
        expect(headerConnectSrc(), 'Electron 헤더 CSP에 없다 — 앱에서 Failed to fetch가 난다')
            .toContain('https://api.github.com')
    })

    // 헤더가 더 넓은 것은 무해하다(페이지가 안 쓸 뿐) — 역방향은 검사하지 않는다.
    it('5. 헤더에만 있는 오리진은 문제 삼지 않는다', () => {
        const header = headerConnectSrc()
        // telegram/emailjs는 문의 알림용이라 페이지 meta에 없을 수 있다
        expect(header.some((o) => o.includes('telegram') || o.includes('emailjs')),
            '전제가 바뀌었다 — 이 테스트의 의미를 재검토하라').toBe(true)
    })
})
