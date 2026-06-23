import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// SLS-1-163: soil-script.js의 SIDO_DETECT_FALLBACK은 constants.js SIDO_PATTERN(SSOT)의
// 수기 복사본이다(window.SIDO_PATTERN 미로드 시에만 활성). 폴백은 평소 동작하지 않아
// drift가 조용히 누적될 수 있으므로, 두 정규식 본문이 동일함을 테스트로 고정한다.
//
// SIDO_DETECT_FALLBACK은 모듈 지역 상수(window 미노출)라 import할 수 없어
// 소스 텍스트에서 정규식 리터럴을 추출해 비교한다.

const __dirname = dirname(fileURLToPath(import.meta.url))

beforeAll(async () => {
    // constants.js 평가 → window.SIDO_PATTERN 노출
    await import('../../src/shared/constants.js')
})

describe('SIDO_DETECT_FALLBACK ↔ constants.js SIDO_PATTERN 동기화 (SLS-1-163)', () => {
    it('soil-script.js의 SIDO_DETECT_FALLBACK 폴백 본문이 SIDO_PATTERN과 정확히 일치', () => {
        const src = readFileSync(
            resolve(__dirname, '../../src/soil/soil-script.js'),
            'utf8'
        )
        const m = src.match(/const SIDO_DETECT_FALLBACK = \/(.+)\/;/)
        expect(m, 'soil-script.js에서 SIDO_DETECT_FALLBACK 선언을 찾지 못함').toBeTruthy()

        const fallbackSource = m[1]
        expect(window.SIDO_PATTERN).toBeInstanceOf(RegExp)
        // RegExp.source에는 슬래시가 포함되지 않으므로 추출한 리터럴 본문과 직접 비교
        expect(fallbackSource).toBe(window.SIDO_PATTERN.source)
    })
})
