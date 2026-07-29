import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 화면에 노출되는 Firebase 제품명 (SLS-1-208)
//
// SLS-1-190·191(v1.10.14)이 개인정보보호법 대응으로 설정 카드와 설명서 클라우드 섹션을
// 숨겼는데, **숨겨지지 않은 화면에 "Firebase" 글자가 그대로 남아 있었다.**
// 앱을 열고 메인 화면 동기화 버튼만 눌러도 나왔다.
//
// 규칙 — 한 문장:
//   사용자에게 보이는 문구는 바꾼다. 단, 실제 제품 자원(콘솔 URL, firebase-auth.json
//   파일명)을 가리키는 고유명사는 남긴다 — 이름을 바꾸면 사용자가 그 자원을 못 찾는다.
//
// ⚠️ 4번 테스트가 이 파일의 핵심이다. 전체 치환(sed s/Firebase/클라우드/g)을 하면
//    식별자까지 바뀌어 **기존에 클라우드를 연동해 쓰는 사용자의 동기화가 죽는다.**
//    v1.10.14 릴리스노트가 "기능 자체를 제거한 것은 아닙니다"라고 약속했다.

const read = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

/** alert/confirm/prompt/innerHTML 인자 안의 문자열만 뽑는다 */
function userFacingStrings(src) {
    const out = []
    const re = /(?:alert|confirm|prompt)\s*\(|innerHTML\s*=/g
    let m
    while ((m = re.exec(src))) {
        // 호출 지점부터 문장 끝까지 훑어 따옴표/백틱 리터럴을 모은다
        const chunk = src.slice(m.index, m.index + 600)
        const end = chunk.search(/\n\s*(?:\}|const |let |var |if |return )/)
        const body = end > 0 ? chunk.slice(0, end) : chunk
        for (const lit of body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) || []) out.push(lit)
    }
    return out
}

/** settings-card 중 display:none이 없는(=보이는) 카드의 원문만 모은다 */
function visibleCards(html) {
    const lines = html.split('\n')
    const starts = []
    lines.forEach((l, i) => {
        if (l.includes('class="settings-card')) starts.push({ i, hidden: l.includes('display:none') })
    })
    const out = []
    starts.forEach((c, n) => {
        if (c.hidden) return
        const end = n + 1 < starts.length ? starts[n + 1].i : lines.length
        out.push(lines.slice(c.i, end).join('\n'))
    })
    return out.join('\n')
}

describe('사용자에게 보이는 Firebase 제품명', () => {
    // 🚨 이 티켓이 존재하는 이유 — 메인 화면에서 누구나 보던 두 건
    it('1. 메인 동기화·캐시 삭제 알림에 제품명이 없다', () => {
        const main = userFacingStrings(read('src/shared/main-init.js'))
        const cache = read('src/shared/cache-manager.js')
        // cache-manager는 템플릿 리터럴을 변수에 담아 alert(message)로 넘긴다
        const cacheMsg = cache.match(/const message = `[^`]*`/g) || []

        expect(main.filter(s => /firebase/i.test(s)),
            'main-init.js의 alert — index.html:1011 동기화 버튼에서 뜬다').toEqual([])
        expect(cacheMsg.filter(s => /firebase/i.test(s)),
            'cache-manager.js의 alert — 캐시 삭제 confirm 직후 뜬다').toEqual([])
    })

    it('2. 설정 화면의 alert/confirm/innerHTML에 제품명이 없다', () => {
        const hits = userFacingStrings(read('src/settings/settings-script.js'))
            .filter(s => /firebase/i.test(s))
        expect(hits, `남은 노출 문구: ${hits.join(' | ')}`).toEqual([])
    })

    it('3. 보이는 설정 카드의 안내 문구에 제품명이 없다', () => {
        const hits = visibleCards(read('src/settings/index.html'))
            .split('\n').filter(l => /firebase/i.test(l))
        expect(hits, `남은 노출: ${hits.join(' | ')}`).toEqual([])
    })

    // 코드리뷰 MAJOR: 처음엔 숨김 카드 중 646·676만 바꾸고 471·558은 남겨 기준이 갈렸다.
    // 표시 여부는 기준이 아니다 — **실제 자원을 가리키는가**만 본다.
    it('3-b. 숨김 카드의 안내 문구에도 제품명이 없다', () => {
        const allowed = [
            'Content-Security-Policy',              // CSP
            'firebase-auth.json',                   // 실제 파일명
            'id="firebaseForm"',                    // 식별자
            'your-project-id.firebaseapp.com',      // placeholder 예시 도메인
            'Firebase Console',                     // 실제로 그 이름의 화면을 연다
            'https://console.firebase.google.com/', // 그 화면의 주소
        ]
        const hits = read('src/settings/index.html').split('\n')
            .filter(l => /firebase/i.test(l))
            .filter(l => !allowed.some(a => l.includes(a)))
        expect(hits, `자원 지시가 아닌 잔존: ${hits.join(' | ')}`).toEqual([])
    })

    // 🚨 과잉 치환 방어 — 이 단언이 없으면 기능이 죽어도 아무도 모른다
    //
    // ⚠️ 파일별로 검사한다. 전 파일을 합쳐서 보면 일부 파일만 치환해도 다른 파일에
    //    남은 식별자 덕에 통과한다 — 실제로 뮤테이션 M4가 그렇게 살아남았다.
    it('4. 기능 식별자가 파일마다 살아 있다', () => {
        const need = [
            ['src/shared/firebase-config.js', 'firebaseConfig', '동기화 엔진 자체가 죽는다'],
            ['src/settings/settings-script.js', 'firebaseConfig', '설정 화면이 연결 상태를 못 읽는다'],
            ['src/shared/main-init.js', 'firebaseConfig', '메인 화면 전체 동기화가 죽는다'],
            ['src/index.js', 'firebaseConfig', '메인 프로세스 IPC가 끊긴다'],
            ['src/shared/firebase-config.js', 'firebase_config', '기존 사용자 설정을 못 읽는다'],
            ['src/settings/settings-script.js', 'firebase_config', '기존 사용자 설정을 못 읽는다'],
            ['src/shared/cache-manager.js', 'firebase_config', '캐시 클리어가 설정까지 지운다'],
            // ❌ ['src/shared/cache-manager.js', 'firebase-auth.json', ...] 제거 (SLS-1-217)
            //    이 행은 **주석에 걸려 있었다.** cache-manager.js에서 firebase-auth.json은
            //    TODO 문장 안에만 등장했고 코드에는 쓰이지 않는다. 실제 보호 대상은 바로 위
            //    행의 firebase_config(KEYS_TO_PRESERVE 항목)이고 그건 그대로 살아 있다.
            //    사유("인증 파일이 보호 목록에서 빠진다")부터 사실이 아니었다 — 이 파일의
            //    보호 목록에 인증 파일은 처음부터 없다.
            ['src/index.js', 'firebase-auth.json', '인증 파일을 못 찾는다'],
        ]
        for (const [file, id, why] of need) {
            expect(read(file), `${file}에서 ${id}가 사라지면 — ${why}`).toContain(id)
        }
        expect(read('src/index.html'), 'CSP·SDK URL이 바뀌면 SDK가 로드되지 않는다')
            .toMatch(/firebase/i)
    })

    it('5. 실제 자원을 가리키는 고유명사는 남아 있다', () => {
        const settings = read('src/settings/index.html')
        // 이름을 바꾸면 사용자가 그 자원을 못 찾는다.
        // "Firebase Console"은 실제로 그 이름의 화면을 여는 링크 텍스트다 —
        // "클라우드 Console"로 바꾸면 href와 어긋나 사용자를 헷갈리게 한다.
        expect(settings, 'Console 링크 텍스트').toContain('Firebase Console')
        expect(settings, 'Console 주소').toContain('https://console.firebase.google.com/')
        // 반대로 카드 제목은 옆에 firebase-auth.json이 병기돼 있어 이름을 바꿔도
        // 사용자가 파일을 찾을 수 있다 → 바꾼다.
        expect(settings, '카드 제목은 정리 대상이었다').not.toContain('Firebase 인증 파일')
        expect(settings, '파일명은 남아야 한다').toContain('firebase-auth.json')
        expect(read('src/index.js'), '파일 선택 대화상자도 파일명을 남긴다')
            .toContain("'클라우드 인증 파일 선택 (firebase-auth.json)'")
    })

    it('6. 숨겨진 설명서 블록은 건드리지 않았다', () => {
        // 613행·1149행 두 블록 모두 display:none이고, 제품 설정 절차를 단계별로
        // 설명하는 글이라 제품명을 빼면 성립하지 않는다. 노출 위험도 없다.
        const manual = read('src/manual/index.html')
        expect(manual).toContain('display:none')
        expect(/firebase/i.test(manual), '설명서는 유지 대상이다').toBe(true)
    })
})
