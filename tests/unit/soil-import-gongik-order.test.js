import { describe, it, expect, beforeAll } from 'vitest'

// SLS-1-242: 공익직불제 차수(gongikOrder) 가져오기
//
// 🚨 저장값은 '1'/'2' 두 가지뿐이다. 목록 편집 셀·일괄 적용 바가 모두 select이고,
//    공익직불제 내보내기가 그 값을 **그대로** 쓴다(heuktoram-script.js dataRow[C+0]).
//    그래서 알 수 없는 값을 조용히 기본값으로 바꾸면 사용자가 적은 '3차'가
//    잘못된 1차로 **제출 서류에 나간다.** landClass1과 같은 규약으로 오류 행을 만든다.
//
// ⚠️ 이 파일의 절반은 **과잉 매칭을 막는 테스트**다. '차수'는 2자라 접두/접미가 걸린다 —
//    SLS-1-240에서 '대상지'가 '대상지면적'을 끌어간 일이 있었다.

let fns
beforeAll(async () => {
    await import('../../src/shared/sanitize.js')
    await import('../../src/soil/reception-number.js')
    await import('../../src/soil/soil-result-importer.js')
    fns = window.SoilResultImporter?._fns
    expect(fns, '_fns가 노출되지 않았다').toBeTruthy()
})

const mapOne = (header) => {
    const m = fns.computeAutoMapping([header])
    const hit = Object.entries(m).find(([, i]) => i === 0)
    return hit ? hit[0] : null
}

/** 열: [성명, 차수] */
const MAPPING = { name: 0, gongikOrder: 1 }
const preview = (rows, opts = {}) => fns.computePreview({
    rows, mapping: MAPPING, landClass1: '공익직불제', logs: [], ...opts,
})

describe('차수 열을 알아본다', () => {
    it('1. 차수 헤더가 gongikOrder에 붙는다 (요청)', () => {
        for (const h of ['차수', '공익차수', '점검차수', '이행점검차수']) {
            expect(mapOne(h), `'${h}'를 못 읽는다`).toBe('gongikOrder')
        }
    })

    // 🚨 '차수'는 2자라 접두/접미·부분 매칭이 걸린다. 기존 매핑을 빼앗으면
    //    지금 잘 되던 서식이 조용히 망가진다 (SLS-1-240에서 실제로 겪었다).
    it('2. 기존 헤더의 매핑을 빼앗지 않는다', () => {
        const expected = {
            경지구분1차: 'landClass1', 경지1차: 'landClass1',
            경지구분2차: 'subCategory', 경지2차: 'subCategory',
            접수번호: 'receptionNumber', 시료번호: 'receptionNumber',
            대상지: 'lotAddress', '대상지면적(㎡)': 'area',
            성명: 'name', 면적: 'area', 비고: 'note',
        }
        for (const [h, want] of Object.entries(expected)) {
            expect(mapOne(h), `'${h}'가 차수에 끌려갔다`).toBe(want)
        }
    })

    // ⚠️ '차수'가 2자라 '조사차수'·'차수별' 같은 헤더도 부분 매칭으로 걸린다.
    //    **정책을 고정해 둔다** — 차수 계열은 받아들이는 쪽이 낫다(뜻이 같다).
    //    반대로 '차수'와 무관한 헤더는 걸리면 안 된다.
    it('2-b. 차수 계열 변형의 정책을 고정한다', () => {
        // 뜻이 같은 변형은 받는다
        for (const h of ['조사차수', '신청차수', '차수별']) {
            expect(mapOne(h), `'${h}'가 차수로 안 잡힌다`).toBe('gongikOrder')
        }
        // ⚠️ '차수구분'은 **subCategory로 남긴다** (실측). '구분'이 이기는데,
        //    "차수"인지 "구분"인지 헤더만으로 알 수 없는 애매한 이름이라
        //    기존 동작을 유지하는 편이 안전하다.
        expect(mapOne('차수구분'), "'차수구분' 동작이 바뀌었다").toBe('subCategory')
        // '차수'가 들어가지 않은 헤더는 걸리지 않는다
        for (const h of ['차량번호', '수량', '순서']) {
            expect(mapOne(h), `'${h}'가 차수로 끌려갔다`).not.toBe('gongikOrder')
        }
    })

    it('3. 키워드 중복 감사에 걸리지 않는다', () => {
        expect(fns.auditDuplicateKeywords(), '두 필드에 같은 키워드가 들어갔다').toEqual([])
    })
})

describe('값을 표준값으로 맞춘다', () => {
    const val = (v) => fns.resolveGongikOrder(v, '1')

    // 🚨 `.value`만 보면 안 된다. 실패해도 fallback이 '1'이라 **기대값이 '1'인 단언은
    //    전부 그냥 통과한다** — 처음에 전각 테스트를 그렇게 썼다가 변이가 살아남았다.
    //    값이 맞는지와 **오류가 없는지**를 함께 본다.
    const ok = (v, want) => {
        const r = val(v)
        expect(r.error, `${JSON.stringify(v)}가 오류로 처리됐다`).toBe('')
        expect(r.value, `${JSON.stringify(v)}를 못 읽는다`).toBe(want)
    }

    it('4. 우리 내보내기 산출물의 표기(1·2)를 그대로 읽는다', () => {
        ok('1', '1'); ok('2', '2')
        // 숫자 셀 — _normalizeCell이 문자열로 바꾸지만 직접 와도 받는다
        ok(1, '1'); ok(2, '2')
    })

    it("5. 사람이 적은 '1차'·'2차'도 읽는다", () => {
        ok('1차', '1'); ok('2차', '2')
        ok(' 2 차 ', '2')
    })

    it('6. 전각 숫자도 읽는다 (toAsciiDigits 재사용)', () => {
        ok('１', '1')
        ok('１차', '1')
        ok('２차', '2')   // fallback('1')과 다른 값이라 이 한 줄만으로도 구분된다
    })

    // ⚠️ 빈 칸은 오류가 아니다 — 공익직불제가 아닌 시료에는 이 열 자체가 없다
    it('7. 빈 칸은 기본값이고 오류가 아니다', () => {
        for (const v of ['', '   ', null, undefined]) {
            const r = val(v)
            expect(r.value, `${JSON.stringify(v)}가 기본값이 아니다`).toBe('1')
            expect(r.error, `${JSON.stringify(v)}가 오류가 됐다`).toBe('')
        }
    })

    // 🚨 조용히 1차로 바꾸면 제출 서류의 차수가 틀린 채 나간다
    it('8. 알 수 없는 값은 오류이고, 사유에 그 값과 고칠 방법이 있다', () => {
        for (const v of ['3차', '가을', '1-2', 'A']) {
            const r = val(v)
            expect(r.error, `'${v}'를 조용히 삼켰다`).toBeTruthy()
            expect(r.error).toContain(String(v))
            expect(r.error, '고칠 방법을 안 알려 준다').toMatch(/1 또는 2/)
        }
    })

    // ⚠️ 지원 범위를 **일부러 좁게** 둔다. 변형을 계속 더하면 뜻 모를 값까지 삼킨다.
    it("9. '제1차' 같은 변형은 지원하지 않는다 (의도된 범위)", () => {
        expect(val('제1차').error, '범위를 넓히면 뜻 모를 값까지 삼킨다').toBeTruthy()
    })
})

describe('미리보기에서의 동작', () => {
    it('10. 행의 차수가 rec.gongikOrder에 들어간다', () => {
        const p = preview([['홍길동', '2'], ['김철수', '1차']])
        expect(p.items.map((it) => it.rec.gongikOrder)).toEqual(['2', '1'])
        expect(p.stats.err).toBe(0)
    })

    it('11. 알 수 없는 값은 오류 행이 된다', () => {
        const p = preview([['홍길동', '3차']])
        expect(p.stats.err, '오류로 안 빠졌다').toBe(1)
        expect(p.willImport, '저장 대상에 남았다').toBe(0)
        expect(p.items[0].reason).toContain('3차')
    })

    // 🚨 코드리뷰 MAJOR — 차수는 **공익직불제 내보내기에서만** 쓰인다.
    //    일반 시료 파일에 우연히 '차수' 열이 있다고 해서 무관한 행의 가져오기를
    //    막으면 안 된다. 그 행에서는 값이 안 쓰이므로 조용히 넘어가는 것이 맞다.
    it('11-b. 공익직불제가 아닌 행은 알 수 없는 차수여도 막히지 않는다', () => {
        const p = fns.computePreview({
            rows: [['홍길동', '3차']],
            mapping: MAPPING, landClass1: '농가의뢰', logs: [],
        })
        expect(p.stats.err, '무관한 행의 가져오기를 막았다').toBe(0)
        expect(p.willImport, '저장 대상에서 빠졌다').toBe(1)
    })

    it('11-c. 같은 배치에서 공익직불제 행만 막힌다 (1차는 행마다 다르다)', () => {
        const p = fns.computePreview({
            rows: [['가', '공익직불제', '3차'], ['나', '농가의뢰', '3차']],
            mapping: { name: 0, landClass1: 1, gongikOrder: 2 },
            landClass1: '농가의뢰', logs: [],
        })
        expect(p.stats.err, '공익직불제 행이 안 막혔거나 무관한 행까지 막혔다').toBe(1)
        expect(p.willImport, '농가의뢰 행이 저장 대상에서 빠졌다').toBe(1)
    })

    // 🚨 열이 없던 기존 사용자가 영향을 받으면 안 된다
    it('12. 열이 매핑되지 않으면 전부 기본값이고 오류가 없다', () => {
        const p = fns.computePreview({
            rows: [['홍길동', '아무거나'], ['김철수', '3차']],
            mapping: { name: 0 }, landClass1: '공익직불제', logs: [],
        })
        expect(p.stats.err, '매핑 안 된 열 때문에 오류가 났다').toBe(0)
        expect(p.items.every((it) => it.rec.gongikOrder === '1')).toBe(true)
    })
})
