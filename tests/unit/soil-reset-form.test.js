import { describe, it, expect, beforeAll, beforeEach } from 'vitest'

// SLS-1-176: form.reset() 호출 시 동적으로 채워지는 <select id="landClass1">이
//   HTML selected 속성 없이 생성되어 브라우저가 첫 번째 옵션('개량제')으로 되돌리는 버그.
//   cancelEditMode()에서 한 번 고쳐진 뒤 _submitNewRegistration()/resetFormKeepReceptionInfo()에서
//   같은 패턴이 재발해(3회째), 공유 헬퍼 _resetFormPreservingSelects()로 통합했다.
//
//   soil-populate-form.test.js의 createManager()는 landClass1Select가 form 밖 detached input이고
//   form이 reset() 없는 순수 객체라, 그 스텁을 그대로 쓰면 복원 로직을 지워도 테스트가 통과하는
//   false-green이 된다(critic v2 리뷰 지적). 그래서 여기서는 실제 <form> + 그 자식 <select>로 구성한다.

beforeAll(async () => {
    await import('../../src/shared/BaseSampleManager.js')
    if (window.DOMPurify && typeof window.DOMPurify.addHook !== 'function') {
        window.DOMPurify.addHook = () => {}
    }
    await import('../../src/shared/sanitize.js')
    globalThis.sanitizeHTML = window.sanitizeHTML
    globalThis.escapeHTML = window.escapeHTML
    await import('../../src/soil/soil-log-record.js')
    // cancelEditMode()가 generateNextReceptionNumber() → window.ReceptionNumber.computeNextNumber를 호출
    await import('../../src/soil/reception-number.js')
    await import('../../src/soil/soil-script.js')
})

// form.reset()이 실제로 select를 첫 옵션으로 되돌리도록, landClass1/yearSelect를
// 진짜 <form>의 자식으로 둔다 (detached input이면 reset이 건드리지 않아 회귀를 못 잡는다).
function createManagerWithRealForm() {
    document.body.innerHTML = `
        <form id="soilForm">
            <select id="landClass1">
                <option value="개량제">개량제</option>
                <option value="농가의뢰">농가의뢰</option>
                <option value="전략">전략</option>
            </select>
            <select id="yearSelect">
                <option value="2025">2025</option>
                <option value="2026">2026</option>
            </select>
            <input id="subCategory" />
        </form>
        <input id="name" />
        <input id="phoneNumber" />
        <input id="note" />
        <div id="formView" class="view"></div>
        <button class="nav-btn" data-view="form"></button>
        <div id="parcelsContainer"></div>
    `

    const m = new window.SoilSampleManager()
    m.selectedYear = '2026'
    m.log = () => {}
    m.showToast = () => {}
    m.renderParcelCard = () => {}

    const el = (tag) => document.createElement(tag)
    m.form = document.getElementById('soilForm')
    m.landClass1Select = document.getElementById('landClass1')
    m.receptionNumberInput = el('input')
    m.dateInput = el('input')
    m.dateInput.type = 'date'
    m.addressPostcode = el('input')
    m.addressRoad = el('input')
    m.addressDetail = el('input')
    m.addressHidden = el('input')
    m.purposeSelect = el('input')
    m.receptionMethodInput = el('input')
    m.parcelsDataInput = el('input')
    m.parcelsContainer = document.getElementById('parcelsContainer')
    m.navSubmitBtn = el('button')
    return m
}

describe('SLS-1-176: form.reset() 후 landClass1Select 값 보존', () => {
    let m
    beforeEach(() => { m = createManagerWithRealForm() })

    it('_resetFormPreservingSelects()는 form.reset() 후에도 이전 값을 복원한다', () => {
        m.landClass1Select.value = '농가의뢰'
        expect(m.landClass1Select.value).toBe('농가의뢰')

        m._resetFormPreservingSelects()

        // form.reset()만 호출했다면 첫 옵션('개량제')으로 돌아갔을 것 — 복원 로직이 이를 되돌린다.
        expect(m.landClass1Select.value).toBe('농가의뢰')
    })

    it('resetFormKeepReceptionInfo() 호출("초기화" 버튼) 후에도 landClass1 값이 유지된다', () => {
        m.landClass1Select.value = '전략'

        m.resetFormKeepReceptionInfo()

        expect(m.landClass1Select.value).toBe('전략')
    })

    it('cancelEditMode() 호출(수정 취소) 후에도 landClass1 값이 유지된다', () => {
        m.landClass1Select.value = '농가의뢰'

        m.cancelEditMode()

        expect(m.landClass1Select.value).toBe('농가의뢰')
    })
})
