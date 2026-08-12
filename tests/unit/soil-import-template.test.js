import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// SLS-1-225: 가져오기 기본 서식 다운로드
//
// ⚠️ 신규 기능이 아니라 **복구**다. 구 모달에 서식 다운로드가 있었으나 그 모달 진입점이
//    hidden 처리되면서 의도치 않게 함께 사라졌다(플랜 리뷰 MAJOR 3).
//
// ⚠️ 8번이 이 파일의 핵심이다. 헤더가 라벨과 같아도 **자동 매핑이 실제로 붙는지는 별개**다.
//    특히 addressRoad는 label('농가주소(경작자)')과 첫 별칭('농가주소')이 다르다 —
//    "첫 별칭 = label"이라는 내 초안 근거가 거짓이었다. 왕복으로만 확인할 수 있다.
//
// ⚠️ _downloadTemplate()이 아니라 순수 함수 buildTemplateSheets()를 검증한다.
//    window.XLSX는 frozen 네임스페이스라 가로채기가 까다롭고, 실제로 그 때문에 테스트가
//    조용히 통과한 사고가 있었다(tests/e2e/soil-export-sheets.spec.js:1-7).

const SRC = readFileSync(resolve(process.cwd(), 'src/soil/soil-result-importer.js'), 'utf8')

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/soil-result-importer.js')
    // 인스턴스가 만들어져야 _fns가 붙는다
    fns = window.SoilResultImporter?._fns || window.soilResultImporter?._fns
    if (!fns) {
        const inst = window.SoilResultImporter
        fns = inst?._fns
    }
})

const sheetsOf = () => fns.buildTemplateSheets()
const byName = (n) => sheetsOf().find((s) => s.name === n)

/** 소스에서 LAND_CLASS1_OPTIONS를 뽑는다 (모듈이 내보내지 않으므로) */
function landClassOptions() {
    const m = SRC.match(/const LAND_CLASS1_OPTIONS = \[([^\]]+)\]/)
    expect(m, 'LAND_CLASS1_OPTIONS를 찾지 못했다').toBeTruthy()
    return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))
}

describe('서식 구조', () => {
    it('1. 시트 4개가 정확한 이름으로 생성된다', () => {
        expect(sheetsOf().map((s) => s.name)).toEqual(['자체', '대표필지', '농가의뢰', '공익직불제'])
    })

    it('7. 시트명이 전부 경지구분 목록에 있다 (후속 시트 일괄 가져오기 대비)', () => {
        const opts = landClassOptions()
        for (const s of sheetsOf()) {
            expect(opts, `'${s.name}'이 LAND_CLASS1_OPTIONS에 없다`).toContain(s.name)
        }
    })

    it('9. 예시 행이 헤더 다음 1줄만 있다', () => {
        for (const s of sheetsOf()) {
            expect(s.rows, `${s.name} 시트`).toHaveLength(1)
            expect(s.rows[0], `${s.name} 열 수 불일치`).toHaveLength(s.headers.length)
        }
    })
})

describe('개인정보 분리', () => {
    const PII = ['성명', '연락처', '농가주소(경작자)']

    it('3. 자체·대표필지에 개인정보 열이 없다', () => {
        for (const name of ['자체', '대표필지']) {
            const h = byName(name).headers
            for (const p of PII) {
                expect(h, `${name} 시트에 '${p}'가 있다 — 개인정보가 들어갈 자리가 생긴다`).not.toContain(p)
            }
        }
    })

    it('4. 자체와 대표필지의 열 구성이 같다', () => {
        expect(byName('자체').headers).toEqual(byName('대표필지').headers)
    })

    it('5. 농가의뢰에 성명·연락처·농가주소가 있다', () => {
        const h = byName('농가의뢰').headers
        for (const p of PII) expect(h, `농가의뢰에 '${p}'가 없다`).toContain(p)
    })

    it('6. 공익직불제에 경영체등록번호·접수일자가 있다', () => {
        const h = byName('공익직불제').headers
        expect(h).toContain('경영체등록번호')
        expect(h).toContain('접수일자')
    })

    it('공익직불제 = 농가의뢰 + 2열', () => {
        const farmer = byName('농가의뢰').headers
        const gongik = byName('공익직불제').headers
        expect(gongik.slice(0, farmer.length)).toEqual(farmer)
        expect(gongik).toHaveLength(farmer.length + 2)
    })
})

describe('헤더가 코드와 어긋나지 않는다', () => {
    it('2. 모든 헤더가 TARGET_FIELDS의 label과 일치한다', () => {
        // 소스에서 label 집합을 뽑아 대조 — 문자열 리터럴로 헤더를 적으면 여기서 걸린다
        const labels = [...SRC.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1])
        expect(labels.length, 'label을 하나도 못 뽑았다').toBeGreaterThan(5)
        for (const s of sheetsOf()) {
            for (const h of s.headers) {
                expect(labels, `'${h}'가 TARGET_FIELDS의 label이 아니다`).toContain(h)
            }
        }
    })

    // 🚨 이 기능의 존재 이유 — 서식대로 쓰면 매핑이 손 안 대고 맞아야 한다
    //
    // ⚠️ 초안은 "모든 열 인덱스가 mapping 값에 있는가"만 봤다. 그러면 열이 **엉뚱한
    //    필드에** 붙어도 통과한다(codex 리뷰 MINOR-1) — 예: '농가주소' 헤더가
    //    lotAddress가 아니라 addressRoad로 가도 인덱스는 존재하므로 통과.
    //    헤더가 **의도한 필드 키에** 붙었는지까지 본다.
    it('8. 왕복: 각 시트 헤더가 의도한 필드에 정확히 매핑된다', () => {
        for (const s of sheetsOf()) {
            const mapping = fns.computeAutoMapping(s.headers)
            s.fields.forEach((key, i) => {
                expect(mapping[key],
                    `'${s.name}' 시트: 헤더 '${s.headers[i]}'(열 ${i})가 '${key}'에 매핑되지 않았다 ` +
                    `(실제 매핑: ${JSON.stringify(mapping)})`)
                    .toBe(i)
            })
        }
    })
})

describe('예시 행이 그대로 등록되지 않게 한다', () => {
    // 🚨 플랜 리뷰 MAJOR 3 — 식별 검사(:345, :372)는 지번주소만 있어도 통과한다.
    //    안내를 비고에만 두면 가장 안 보는 칸이라 소용없다.
    it('10. 예시 지번주소에 경고 표시가 있다', () => {
        for (const s of sheetsOf()) {
            const idx = s.headers.indexOf('지번주소')
            expect(idx, `${s.name}에 지번주소 열이 없다`).toBeGreaterThan(-1)
            expect(s.rows[0][idx], `${s.name} 예시 지번주소가 진짜 주소처럼 보인다`)
                .toMatch(/예시|삭제/)
        }
    })

    it('11. 예시 접수번호가 비어 있다 (도구 권장값과 일치)', () => {
        for (const s of sheetsOf()) {
            const idx = s.headers.indexOf('접수번호')
            expect(idx).toBeGreaterThan(-1)
            expect(s.rows[0][idx], `${s.name} 예시에 접수번호가 들어 있다`).toBe('')
        }
    })
})
