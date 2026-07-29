import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 릴리스노트 개인정보보호 대응 (SLS-1-201)
//
// v1.10.14(SLS-1-190·191)에서 개인정보보호법 대응으로 설정 화면·설명서의 클라우드 연동
// UI를 숨겼는데, 릴리스노트에는 "Firebase"가 6건 그대로 남아 있었다.
// 화면에서 숨긴 것을 릴리스노트가 다시 설명하는 모순 상태였다.
//
// ⚠️ 문자 그대로 삭제하지 않았다. v1.10.14는 제목과 항목 2개가 전부 그 내용이라
//    지우면 빈 버전 카드가 남고, 그 버전을 쓰는 사용자가 자기 버전 항목을 못 찾는다.
//    배포 이력은 보존하고 제품명만 걷어냈다.

const SRC = readFileSync(resolve(process.cwd(), 'src/release/index.html'), 'utf8')

describe('릴리스노트 Firebase 노출', () => {
    it('1. 제품명이 한 건도 남지 않았다', () => {
        const hits = SRC.match(/firebase|firestore|파이어베이스/gi) || []
        expect(hits, `남은 언급: ${hits.join(', ')}`).toHaveLength(0)
    })

    it('2. 배포 이력이 줄지 않았다', () => {
        // 버전 카드 하나가 통째로 사라지면 그 버전 사용자가 자기 항목을 못 찾는다.
        // 릴리스마다 이 숫자를 함께 올린다 (v1.14.3에서 50 → 51).
        expect((SRC.match(/class="version-dot/g) || []).length).toBe(51)
    })

    // 🚨 새 버전을 추가하면서 이전 버전의 "최신" 표시를 안 내리면 배지가 두 개 뜬다.
    //    SLS-1-209 플랜 리뷰가 짚기 전까지 이걸 잡는 테스트가 하나도 없었다 —
    //    빌드도 통과하고 유닛·E2E도 통과한다. 눈으로만 보이는 결함이다.
    it('6. "최신" 표시가 정확히 하나다', () => {
        expect((SRC.match(/badge badge-latest/g) || []).length, '★ 최신 배지').toBe(1)
        expect((SRC.match(/version-dot latest/g) || []).length, '타임라인 점').toBe(1)
        // 최신 표시는 맨 위 버전에 붙어야 한다
        const firstDot = SRC.indexOf('class="version-dot')
        expect(SRC.slice(firstDot, firstDot + 30), '맨 위 버전이 최신이어야 한다')
            .toContain('version-dot latest')
    })

    it('7. 앱 버전과 릴리스노트 최신 버전이 일치한다', () => {
        // 버전 3곳 동기화가 조용히 실패해도 빌드는 통과한다 — 실제로 났던 사고다.
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))
        const constants = readFileSync(resolve(process.cwd(), 'src/shared/constants.js'), 'utf8')
        const index = readFileSync(resolve(process.cwd(), 'src/index.html'), 'utf8')

        expect(constants, 'constants.js APP_VERSION').toContain(`'${pkg.version}'`)
        expect(index, 'index.html #appVersion').toContain(`>v${pkg.version}<`)
        // 릴리스노트 맨 위 버전 = package.json 버전
        const topVersion = SRC.match(/version-number">v([\d.]+)/)[1]
        expect(topVersion, '릴리스노트에 이 버전 항목이 없으면 사용자가 변경 내역을 못 본다')
            .toBe(pkg.version)
    })

    it('3. v1.10.14 블록이 비지 않았다', () => {
        // 제목·항목이 전부 Firebase 내용이었던 유일한 버전.
        // 항목을 다 지우면 제목 없는 빈 카드가 되어 명백한 버그로 보인다.
        const block = SRC.match(/v1\.10\.14[\s\S]*?<\/ul>/)
        expect(block, 'v1.10.14 블록을 찾지 못했다').toBeTruthy()
        expect((block[0].match(/<li>/g) || []).length).toBe(2)
        expect(block[0]).toContain('version-title')
    })

    it('4. "영향 없음" 안내가 보존됐다', () => {
        // 이미 클라우드를 쓰던 소수 사용자에게 가장 중요한 문장이다.
        // 일반화하다가 이 메시지가 사라지면 그 사용자는 기능이 없어진 줄 안다.
        const block = SRC.match(/v1\.10\.14[\s\S]*?<\/ul>/)[0]
        expect(block).toContain('영향 없음')
        expect(block).toContain('기능 자체를 제거한 것은 아닙니다')
    })

    it('5. 없는 분류를 지어내지 않았다', () => {
        // 플랜 리뷰 MAJOR-1: 처음엔 "고급 설정"으로 썼으나 설정 화면에 '고급'이라는
        // 분류가 없다. 명칭 일반화가 아니라 창작이라 사실 왜곡이다.
        const settings = readFileSync(resolve(process.cwd(), 'src/settings/index.html'), 'utf8')
        const hasAdvancedCategory = /고급/.test(settings)
        const claimsAdvanced = /고급 설정/.test(SRC)
        expect(claimsAdvanced && !hasAdvancedCategory,
            '설정 화면에 없는 "고급" 분류를 릴리스노트가 주장한다').toBe(false)
    })
})
