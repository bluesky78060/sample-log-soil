import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// SLS-1-200 코드리뷰 MAJOR-2 / MINOR-1
//
// 접수 엑셀 가져오기의 헤더 별칭과 레코드 조립을 고정한다.
//   · farmArea가 0으로 고정 주입되면 흙토람 내보내기에서 면적이 무조건 공란이 된다
//     (양식상 가축분퇴비는 면적 필수). 부숙도 합격선도 조용히 완화된다.
//   · '채취일'이 productionDate를 가리키면 양식 T열(채취일자)과 U열(생산일자)이 뒤바뀐다.
//
// 빌드 산출물은 압축되어 소스 매칭이 깨지므로 원본 파일을 읽는다.

const SRC = fs.readFileSync(
    path.join(__dirname, '../../src/compost/compost-script.js'), 'utf8')

/** autoMapRules에서 별칭 → 필드 매핑을 뽑는다 */
const alias = (name) => {
    const m = SRC.match(new RegExp(`'${name}':\\s*'([a-zA-Z]+)'`))
    return m ? m[1] : null
}

describe('접수 엑셀 가져오기 별칭', () => {
    it('1. 채취일 계열은 samplingDate로 간다 (양식 T열)', () => {
        expect(alias('채취일')).toBe('samplingDate')
        expect(alias('채취일자')).toBe('samplingDate')
    })

    it('2. 생산일 계열은 productionDate로 간다 (양식 U열)', () => {
        expect(alias('생산일')).toBe('productionDate')
        expect(alias('생산일자')).toBe('productionDate')
    })

    it('3. 면적 별칭이 있다', () => {
        expect(alias('면적')).toBe('farmArea')
        expect(alias('농장면적')).toBe('farmArea')
    })
})

describe('가져오기 레코드 조립', () => {
    it('4. farmArea가 0으로 고정 주입되지 않는다', () => {
        // 이전: `farmArea: 0,` 하드코딩
        expect(SRC).not.toMatch(/farmArea:\s*0\s*,/)
        expect(SRC).toContain("parseFormattedNumber(getVal('farmArea')")
    })

    it('5. samplingDate가 레코드에 포함된다', () => {
        expect(SRC).toContain("parseExcelDate(getVal('samplingDate'))")
    })
})
