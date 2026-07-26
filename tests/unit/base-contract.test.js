import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// SLS-1-192 계약 회귀 테스트
//
// 플랜 검증의 메서드 대조(comm)는 두 가지를 원리적으로 탐지하지 못한다.
//   (1) 생성자 상태 필드 차이 — 메서드 이름만 비교하므로
//   (2) 같은 이름 다른 계약 — 서브클래스가 base와 다른 시그니처로 정의한 경우
// 두 맹점 모두 실제로 결함을 만들어냈으므로(생성자 editingGroupIds 누락,
// persistRecords 인자 의미 역전) 여기서 기계적으로 고정한다.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    await import('../../src/shared/utils.js')
})

function createManager() {
    return new window.BaseSampleManager({
        moduleKey: 'test',
        moduleName: '테스트',
        storageKey: 'testSampleLogs',
        autoSaveFile: 'test-autosave.json'
    })
}

describe('생성자 상태 필드 (comm 대조가 못 잡는 영역)', () => {
    it('editingGroupIds가 빈 배열로 초기화된다', () => {
        const m = createManager()
        // 백포트된 editSample/resetForm 본문이 이 필드를 직접 참조한다.
        expect(Array.isArray(m.editingGroupIds)).toBe(true)
        expect(m.editingGroupIds).toHaveLength(0)
    })

    it('currentSearchFilter가 객체로 초기화된다', () => {
        const m = createManager()
        // 필터 매처 5개가 이 객체의 존재를 전제한다.
        expect(m.currentSearchFilter).toBeTypeOf('object')
        expect(m.currentSearchFilter).not.toBeNull()
    })

    it('isCloudSyncing은 의도적으로 제외되어 있다', () => {
        const m = createManager()
        // syncWithCloud를 백포트하지 않았으므로 함께 제외한다.
        // (soil은 SLS-1-121에서 동기화를 loadYearData 경로로 일원화)
        expect(m.isCloudSyncing).toBeUndefined()
    })
})

describe('백포트된 base 메서드 존재', () => {
    const BACKPORTED = [
        'applyLegacyAddress', 'collectCommonFormData', 'enterEditModeUI',
        'extractReceptionNumber', 'getFilterKeys', 'getLabelAddressParts',
        'matchesCompletedFilter', 'matchesDateFilter', 'matchesNameFilter',
        'matchesReceptionFilter', 'matchesTypeSpecificFilters', 'onAfterFormReset',
        'openLabelPrintWithData', 'populateApplicantType', 'populateCommonFields',
        'populateReceptionMethod', 'populateTypeSpecificFields', 'shouldPreserveDateOnReset',
        'switchToEditFormView', 'updateSearchButtonState'
    ]

    it('20개가 모두 함수로 존재한다', () => {
        const m = createManager()
        const missing = BACKPORTED.filter(name => typeof m[name] !== 'function')
        expect(missing).toEqual([])
    })

    it('editSample이 더 이상 abstract thrower가 아니다', () => {
        const m = createManager()
        // 백포트 전에는 호출 즉시 throw했다. 존재하지 않는 id로 호출해도
        // editSample은 조용히 반환해야 한다.
        expect(() => m.editSample('nonexistent-id')).not.toThrow()
    })

    it('resetForm이 접수번호 재생성까지 실제로 수행한다', () => {
        // #receptionNumber가 없으면 generateNextReceptionNumber 호출 줄이 실행되지 않아
        // 테스트가 공허하게 통과한다. DOM을 갖춰 그 경로를 실제로 태운다.
        // date는 type을 명시해야 한다 — jsdom은 text input의 valueAsDate 설정에
        // DOMException을 던진다 (실제 앱의 접수일자 입력은 type="date")
        document.body.innerHTML = '<input id="receptionNumber"><input id="date" type="date">'
        const m = createManager()
        m.generateNextReceptionNumber = () => '503'
        expect(() => m.resetForm()).not.toThrow()
        expect(document.getElementById('receptionNumber').value).toBe('503')
        // 편집 상태도 해제되어야 한다
        expect(m.editingId).toBeNull()
        expect(m.editingGroupIds).toHaveLength(0)
        document.body.innerHTML = ''
    })

    it('generateNextReceptionNumber 미구현 시 계약 위반을 즉시 드러낸다', () => {
        document.body.innerHTML = '<input id="receptionNumber">'
        const m = createManager()
        // 서브클래스가 구현하지 않으면 조용한 오작동 대신 명시적 실패
        expect(() => m.resetForm()).toThrow(/generateNextReceptionNumber/)
        document.body.innerHTML = ''
    })
})

describe('의도적 제외 4개', () => {
    const EXCLUDED = ['getGroupMembers', 'hasChanges', 'persistRecords', 'syncWithCloud']

    it('base에 정의되지 않는다', () => {
        const m = createManager()
        const present = EXCLUDED.filter(
            name => Object.getPrototypeOf(m).hasOwnProperty(name)
        )
        // persistRecords를 base에 넣으면 soil-script.js:581과 계약이 충돌한다
        // (base: (newLogs, removedIds) → 삭제 / soil: (records) → 저장).
        expect(present).toEqual([])
    })
})

describe('SoilSampleManager 계약 보존', () => {
    const soilScript = readFileSync(
        resolve(__dirname, '../../src/soil/soil-script.js'), 'utf8'
    )

    it('persistRecords를 1-arg로 자체 정의한다', () => {
        // base에 2-arg 버전이 들어오면 인자 의미가 역전되어 삭제가 조용히 유실된다.
        expect(soilScript).toMatch(/^\s{4}persistRecords\(records\)\s*\{/m)
    })

    it('base 본문 교체 대상 4개를 자체 오버라이드한다', () => {
        // 이 오버라이드가 사라지면 base 백포트분이 토양에 직접 노출된다.
        for (const name of ['editSample', 'resetForm', 'filterAndRenderLogs', 'migrateCompletedField']) {
            expect(soilScript).toMatch(new RegExp(`^\\s{4}${name}\\(`, 'm'))
        }
    })
})

describe('shared 부수 의존', () => {
    it('SampleUtils.splitLegacyAddress가 노출된다', () => {
        // 백포트된 applyLegacyAddress가 의존한다.
        expect(typeof window.SampleUtils.splitLegacyAddress).toBe('function')
    })

    it('레거시 "(우편번호) 주소" 형식을 분리한다', () => {
        expect(window.SampleUtils.splitLegacyAddress('(36231) 경북 봉화군 봉화읍 내성로 39'))
            .toEqual({ postcode: '36231', road: '경북 봉화군 봉화읍 내성로 39' })
    })

    it('우편번호가 없으면 road만 채운다', () => {
        expect(window.SampleUtils.splitLegacyAddress('경북 봉화군'))
            .toEqual({ postcode: null, road: '경북 봉화군' })
    })

    it('빈 값은 양쪽 null', () => {
        expect(window.SampleUtils.splitLegacyAddress(''))
            .toEqual({ postcode: null, road: null })
    })
})

describe('시료종 레지스트리 (누락 시 조용한 데이터 유실)', () => {
    const read = (p) => readFileSync(resolve(__dirname, '../../src', p), 'utf8')

    it('settings-script.js 백업 대상에 퇴비가 포함된다', () => {
        // 누락 시 전체 내보내기에서 퇴비가 조용히 빠진다.
        expect(read('settings/settings-script.js')).toMatch(/storagePrefix:\s*'compostSampleLogs'/)
    })

    it('main-init.js 전체 동기화 대상에 퇴비가 포함된다', () => {
        expect(read('shared/main-init.js')).toMatch(/type:\s*'compost'/)
    })

    it('firestore-db.js 컬렉션 매핑에 퇴비가 명시된다', () => {
        // 폴백에 맡기면 compost_2026이 되어 통합본 compostSamples_2026과 갈라진다.
        expect(read('shared/firestore-db.js')).toMatch(/'compost':\s*'compostSamples'/)
    })

    it('cache-manager.js 삭제 패턴에서 퇴비가 제외된다', () => {
        // 남아 있으면 금요일 자동 캐시 클리어가 신규 퇴비 데이터를 삭제한다.
        const src = read('shared/cache-manager.js')
        const patterns = src.match(/SAMPLE_DATA_PATTERNS\s*=\s*\[([\s\S]*?)\]/)
        expect(patterns).not.toBeNull()
        expect(patterns[1]).not.toContain('compostSampleLogs')
        // 레거시 3종은 유지되어야 한다 (SLS-1-134 정리 의도)
        expect(patterns[1]).toContain('waterSampleLogs')
        expect(patterns[1]).toContain('pesticideSampleLogs')
        expect(patterns[1]).toContain('heavyMetalSampleLogs')
    })
})
