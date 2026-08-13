import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// SLS-1-232: 기본 서식은 **원본 .xlsx를 바이트 그대로** 내려준다
//
// 🚨 앞선 시도(SLS-1-231)는 서식을 코드로 생성했다. 결과물에 셀 색·테두리·병합이
//    하나도 없었다 — soil-entry.js의 xlsx(SheetJS CE)는 스타일을 쓰지 못한다.
//    업무 서식은 그 꾸밈이 본질이라 접근 자체가 틀렸다.
//
// ⚠️ 그래서 이 파일이 지키는 것은 "시트 구성"이 아니라 **바이트 동일성**이다.
//    워크북을 열어 시트 이름만 확인하면, XLSX로 읽고 다시 쓰는 구현으로 바뀌어
//    스타일이 다 날아가도 그대로 통과한다.

const SRC_XLSX = resolve(process.cwd(), 'src/assets/soil-import-template.xlsx')
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

let tpl
beforeAll(async () => {
    await import('../../src/shared/soil-template-data.js')
    tpl = window.SOIL_TEMPLATE
    expect(tpl, 'window.SOIL_TEMPLATE이 없다 — scripts/embed-soil-template.js를 돌렸는가').toBeTruthy()
})

/** 내장 base64 → 바이트 (앱과 같은 방식으로 디코드한다) */
const decoded = () => Buffer.from(tpl.base64, 'base64')

describe('원본 파일이 그대로 담겼는가', () => {
    it('원본 .xlsx가 저장소에 있다', () => {
        expect(existsSync(SRC_XLSX), `원본이 없다: ${SRC_XLSX}`).toBe(true)
    })

    // 🚨 이 파일의 핵심 단언
    it('1. 내장 바이트가 원본과 sha256까지 같다', () => {
        const original = readFileSync(SRC_XLSX)
        const embedded = decoded()
        expect(embedded.length, '바이트 수가 다르다').toBe(original.length)
        expect(sha256(embedded), '내장본이 원본과 다르다 — 재생성이 필요하거나 손상됐다')
            .toBe(sha256(original))
    })

    it('2. 기록된 메타(bytes·sha256)가 실제와 맞다', () => {
        const original = readFileSync(SRC_XLSX)
        expect(tpl.bytes).toBe(original.length)
        expect(tpl.sha256).toBe(sha256(original))
    })

    it('3. 다운로드 파일명이 정해져 있다', () => {
        expect(tpl.fileName).toBe('토양_기본서식.xlsx')
    })

    // 스타일이 살아 있는지를 유닛에서 직접 보긴 어렵지만,
    // xlsx 안에 서식 정의(styles.xml)가 들어 있는지는 바이트로 확인할 수 있다
    it('4. 서식 정의(styles.xml)가 들어 있다 — 꾸밈이 살아 있다는 최소 증거', () => {
        expect(decoded().toString('latin1'), 'styles.xml이 없다 — 스타일 없는 파일로 바뀌었다')
            .toContain('styles.xml')
    })
})

describe('생성 스크립트', () => {
    // 원본을 바꾸고 스크립트를 안 돌리면 내장본이 낡는다 — 그걸 잡는다
    it('5. 다시 돌린 결과가 커밋된 파일과 같다', async () => {
        const mod = await import('../../scripts/embed-soil-template.js')
        const { build, OUT } = mod.default ?? mod
        expect(build().body, '원본을 바꾸고 embed-soil-template.js를 안 돌렸다')
            .toBe(readFileSync(OUT, 'utf8'))
    })
})

describe('가져오기와의 왕복 (실제 원본 파일로 확인)', () => {
    let fns
    let XLSX
    beforeAll(async () => {
        await import('../../src/shared/sanitize.js')
        await import('../../src/soil/reception-number.js')
        await import('../../src/soil/soil-result-importer.js')
        fns = window.SoilResultImporter._fns
        XLSX = await import('xlsx')
    })

    const aoaOf = (name) => {
        const wb = XLSX.read(decoded(), { type: 'buffer', cellDates: true })
        return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })
    }
    const sheetNames = () => XLSX.read(decoded(), { type: 'buffer' }).SheetNames

    // 진입점 잃은 잔해가 이 저장소에서 반복해서 혼란을 일으켰다
    // (excel-import-manager, cropModal). 같은 것을 또 남기지 않는다.
    it('6. 서식을 코드로 생성하던 로직이 남아 있지 않다', () => {
        expect(fns.buildTemplateSheets, 'buildTemplateSheets가 아직 남아 있다').toBeUndefined()
    })

    it('7. 헤더가 3행이고 자동 감지가 모든 시트에서 그 행을 찾는다', () => {
        const names = sheetNames()
        expect(names.length, '시트 수가 달라졌다').toBe(3)
        for (const name of names) {
            expect(fns.detectHeaderRow(aoaOf(name)), `'${name}': 헤더 행을 3행으로 못 찾았다`).toBe(2)
        }
    })

    // ⚠️ 원본은 2단 병합 헤더다. '경지구분'이 1차/2차로 병합돼 있어 2차 칸이 빈 채로 읽힌다
    //    → **구분(논/밭/과수)은 수동 매핑이 필요하다.**
    //    결함이 아니라 "원본 그대로"를 택한 대가다. 조용히 두지 않고 여기 고정한다.
    it('8. 구분(2차)은 자동으로 붙지 않는다 — 원본 그대로의 대가', () => {
        const headers = aoaOf('시료접수대장')[2].map(String)
        const mapping = fns.computeAutoMapping(headers)

        expect(mapping.subCategory, '2단 헤더가 풀렸다면 이 테스트를 갱신하라').toBeUndefined()
        // 나머지는 제대로 붙는다 — "다 안 된다"와 구분한다
        expect(headers[mapping.name]).toBe('성명')
        expect(headers[mapping.lotAddress]).toBe('필지 주소')
        expect(headers[mapping.area]).toBe('면적(m²)')
        expect(headers[mapping.date]).toBe('접수일자')
    })

    // SLS-1-234: 경지구분은 이제 **1차 필드**에 붙는다. 필지구분은 여전히 대응 필드가 없다.
    it('9. 필지구분은 막히고, 경지구분은 1차에 붙는다', () => {
        const headers = aoaOf('시료접수대장')[2].map(String)
        const m = fns.computeAutoMapping(headers)
        const used = new Set(Object.values(m))
        expect(used.has(headers.indexOf('필지구분')), '필지구분이 매핑됐다').toBe(false)
        expect(headers[m.landClass1]?.trim(), '경지구분이 1차에 안 붙었다').toBe('경지구분')
    })

    // 🚨 자체·대표필지가 섞이는 유일한 시트다. 여기서 1차가 안 잡히면 기능이 무의미해진다.
    //    서식의 헤더 문구가 바뀌면 여기서 빨간 불이 켜져야 한다.
    it('9-b. 자제, 대표필지 시트에서도 1차 열이 잡힌다', () => {
        const headers = aoaOf('자제, 대표필지')[2].map(String)
        const m = fns.computeAutoMapping(headers)
        expect(headers[m.landClass1]?.trim(), '1차 열을 못 찾았다 — 서식 헤더가 바뀌었는가')
            .toMatch(/경지구분/)
    })

    // 🚨 이걸 안 막으면 '홍길동 / 경기도 시흥시 포동 389'가 정상 접수로 들어간다.
    //    안내문에 "지우고 입력"이라 적혀 있어도 잊는 사람이 있다.
    //    판별 근거는 **서식 자체의 표기**다 — 예시 행 첫 칸이 '예) 필지', '예) 1'.
    //    우리가 마커를 심으려면 파일을 고쳐야 하고, 그러면 "원본 그대로"가 깨진다.
    // ⚠️ 원본은 헤더가 2행(3·4행)이라 예시 행은 **5행 = aoa[4]**다.
    //    처음에 aoa[3](헤더 하단)을 넣었더니 '성명·주소 없음'으로 오류가 나
    //    err=1만 보는 단언이 **엉뚱한 행을 검사하면서 통과**했다.
    //    그래서 개수뿐 아니라 **사유**까지 본다.
    it('10. 원본의 예시 행이 예시로 인식되어 오류 처리된다', () => {
        for (const name of sheetNames()) {
            const aoa = aoaOf(name)
            const sampleRow = aoa[4]
            expect(String(sampleRow?.[0] ?? ''), `${name}: 5행이 예시 행이 아니다`).toMatch(/^예\)/)

            const p = fns.computePreview({
                rows: [sampleRow], mapping: fns.computeAutoMapping(aoa[2].map(String)),
                landClass1: '농가의뢰', logs: [],
            })
            expect(p, `${name}: 미리보기가 안 만들어졌다`).toBeTruthy()
            expect(p.stats.err, `${name}: 예시 행이 오류로 안 빠졌다`).toBe(1)
            expect(p.items[0].reason, `${name}: 다른 이유로 걸렀다 — 예시 판별이 동작하지 않았다`)
                .toMatch(/예시/)
            expect(p.willImport, `${name}: 예시 행이 저장 대상에 남았다`).toBe(0)
        }
    })
})

describe('예시 행 판별', () => {
    let fns
    beforeAll(async () => {
        await import('../../src/shared/sanitize.js')
        await import('../../src/soil/soil-result-importer.js')
        fns = window.SoilResultImporter._fns
    })

    it('11. 원본 서식의 예시 표기만 예시로 본다', () => {
        expect(fns.isSampleRow(['예) 필지', '홍길동'])).toBe(true)
        expect(fns.isSampleRow(['', '', '예) 1'])).toBe(true)      // 앞이 비어도 첫 값이면 본다
        expect(fns.isSampleRow(['예)  필지'])).toBe(true)           // 연속 공백은 접어서 본다
        expect(fns.isSampleRow(['홍길동', '봉화읍 내성리 100'])).toBe(false)
        expect(fns.isSampleRow([])).toBe(false)
    })

    // 🚨 넓게 잡으면 실제 자료가 조용히 빠진다 — 그게 예시가 들어오는 것보다 나쁘다.
    //    예시 유입은 미리보기에서 눈에 보이지만, 오탐으로 빠진 행은 아무도 모른다.
    it('12. "예)"로 시작한다고 다 예시로 보지 않는다', () => {
        for (const row of [
            ['예) 참고사항'],                               // 비고를 첫 열에 적은 자료
            ['예) 2'],                                      // 원본에 없는 표기
            ['홍길동', '봉화읍 내성리 100', '예) 참고'],     // 뒤쪽 칸
            ['예시'],
        ]) {
            expect(fns.isSampleRow(row), `실제 행을 예시로 오인했다: ${JSON.stringify(row)}`).toBe(false)
        }
    })
})
