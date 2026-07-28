/**
 * 퇴·액비 검정 항목 규칙 (SLS-1-205 S1)
 *
 * 시료종류(가축분퇴비/가축분뇨발효액)와 축종에 따라 **행마다 적용 항목이 다르다**.
 *   퇴비 + 돼지 → 함수율·부숙도 + 구리·아연
 *   퇴비 + 소   → 함수율·부숙도 + 염분
 *
 * 이 규칙을 공유 모듈로 두는 이유:
 *   검정결과 페이지(src/compost-analysis/)는 compost-script.js를 로드하지 않는다.
 *   여기 없으면 그쪽에서 규칙을 **다시 쓰게 되고**, 두 벌이 되는 순간 반드시 어긋난다.
 *   특히 격자의 "비해당 셀 건너뛰기"가 이 규칙에서 파생되므로, 어긋나면 돼지 행에
 *   염분이 기록되는 식의 조용한 오염이 생긴다.
 *
 * ⚠️ 기준값의 법적 근거
 *   가축분뇨법 시행령 제12조의2 [별표3] — 퇴비 함수율 70% 이하, 돼지 구리 500·아연 1,200,
 *   소·젖소 염분 2.5%. (괴산군 배포 정부 안내서 PDF에서 표 원문 확인)
 *   액비 함수율 '95 이하'는 **근거 미확인** 상태로 기존 값을 그대로 옮겼다 — 부등호
 *   방향이 반대(하한)일 가능성이 제기됐으나 1차 출처를 확보하지 못했다. SLS-1-200 참조.
 */
(function () {
    'use strict';

    const COMPOST_FIELDS = {
        // === 퇴비 (가축분퇴비) ===
        compost_common: [
            { key: 'moisture', label: '함수율', unit: '%', standard: '70 이하' },
            { key: 'maturity', label: '부숙도', unit: '', type: 'select', options: ['', '미부숙', '부숙초기', '부숙중기', '부숙완료', '완전부숙'], standard: '부숙중기 이상' },
        ],
        compost_cattle: [
            { key: 'salinity', label: '염분', unit: '%', standard: '2.5 이하' },
        ],
        compost_pig: [
            { key: 'copper', label: '구리(Cu)', unit: 'mg/kg', standard: '500 이하' },
            { key: 'zinc', label: '아연(Zn)', unit: 'mg/kg', standard: '1,200 이하' },
        ],
        // === 액비 (가축분뇨발효액) ===
        liquid_common: [
            { key: 'moisture', label: '함수율', unit: '%', standard: '95 이하' },
            { key: 'maturity', label: '부숙도', unit: '', type: 'select', options: ['', '미부숙', '부숙초기', '부숙중기', '부숙완료', '완전부숙'], standard: '부숙중기 이상' },
        ],
        liquid_pig: [
            { key: 'copper', label: '구리(Cu)', unit: 'mg/kg', standard: '70 이하' },
            { key: 'zinc', label: '아연(Zn)', unit: 'mg/kg', standard: '170 이하' },
        ],
    };

    /** 부숙도 순서 (높을수록 잘 부숙됨) */
    const MATURITY_ORDER = { '미부숙': 0, '부숙초기': 1, '부숙중기': 2, '부숙완료': 3, '완전부숙': 4 };

    function getFieldsForSample(sampleType, animalType) {
        const isLiquid = sampleType === '가축분뇨발효액';
        const F = COMPOST_FIELDS;

        const fields = isLiquid
            ? [...F.liquid_common]
            : [...F.compost_common];

        if (isLiquid) {
            // 액비: 돼지만 구리/아연 추가
            if (animalType === '돼지') fields.push(...F.liquid_pig);
        } else {
            // 퇴비: 소→염분, 돼지→구리/아연
            if (animalType === '소') fields.push(...F.compost_cattle);
            else if (animalType === '돼지') fields.push(...F.compost_pig);
        }

        return fields;
    }

    /**
     * 면적을 ㎡로 환산
     * @param {string|number} area - 면적 값
     * @param {string} unit - 'pyeong' 또는 'sqm'
     * @returns {number} ㎡ 값
     */
    function getAreaInSqm(area, unit) {
        const val = parseFloat(area);
        if (isNaN(val)) return 0;
        return unit === 'pyeong' ? Math.round(val * 3.3058) : val;
    }

    /** 배출시설 면적 기준 부숙도 요구 등급 표기 */
    function maturityStandardFor(areaSqm) {
        return areaSqm >= 1500 ? '부숙완료 이상' : '부숙중기 이상';
    }

    // 격자용 파생 — 규칙을 재작성하지 않고 getFieldsForSample에서 유도한다.
    // 100행 × 8열 × 3경로에서 호출되므로 (시료종류|축종) 키로 메모이즈한다.
    const _appliesCache = new Map();
    function appliesTo(fieldKey, sampleType, animalType) {
        const k = `${sampleType}|${animalType}`;
        if (!_appliesCache.has(k)) {
            _appliesCache.set(k, new Set(getFieldsForSample(sampleType, animalType).map(f => f.key)));
        }
        return _appliesCache.get(k).has(fieldKey);
    }

    /**
     * 격자의 결과 열 순서. 흙토람 「성분검사결과 일괄입력 양식」 AB~AI열과 같은 순서다.
     * ⚠️ nitrogen/phosphorus/potassium은 COMPOST_FIELDS에 **아직 없다** — S3에서
     *    checkCompostFieldStatus의 "기준 없는 항목" 가드와 함께 추가한다.
     *    지금 넣으면 standard가 비어 있어 무조건 초록 ✓(허위 적합)가 표시된다.
     */
    const RESULT_FIELDS = ['moisture', 'maturity', 'copper', 'zinc', 'salinity',
        'nitrogen', 'phosphorus', 'potassium'];

    window.CompostFields = {
        COMPOST_FIELDS, MATURITY_ORDER, RESULT_FIELDS,
        getFieldsForSample, getAreaInSqm, maturityStandardFor, appliesTo,
    };
})();
