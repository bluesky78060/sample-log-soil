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

    /**
     * 부숙도 등급 — 흙토람 일괄입력 양식이 받는 5종이 전부다.
     * 안내문(실물 A2 셀): "부숙도_성적은 미부숙, 부숙초기, 부숙중기, 부숙후기,
     * 부숙완료 혹은 01, 02, 03, 04, 05로 입력"
     *
     * ⚠️ 순서가 곧 등급이다. 중간에 끼워 넣으면 뒤쪽 순번이 전부 밀린다 —
     *    판정 기준은 반드시 MATURITY_ORDER['이름']에서 파생할 것 (숫자 금지).
     */
    const MATURITY_GRADES = Object.freeze(['미부숙', '부숙초기', '부숙중기', '부숙후기', '부숙완료']);
    // 배열 인스턴스 하나가 여러 소비처에 그대로 노출된다. 한 곳에서 push/sort하면
    // 다른 화면의 선택지가 조용히 달라진다 — 관례가 아니라 구조로 막는다.
    const MATURITY_OPTIONS = Object.freeze(['', ...MATURITY_GRADES]);

    const COMPOST_FIELDS = {
        // === 퇴비 (가축분퇴비) ===
        compost_common: [
            { key: 'moisture', label: '함수율', unit: '%', standard: '70 이하' },
            { key: 'maturity', label: '부숙도', unit: '', type: 'select', options: MATURITY_OPTIONS, standard: '부숙중기 이상' },
            { key: 'nitrogen', label: '질소(N)', unit: '%', standard: '' },
            { key: 'phosphorus', label: '인산(P₂O₅)', unit: '%', standard: '' },
            { key: 'potassium', label: '칼리(K₂O)', unit: '%', standard: '' },
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
            { key: 'maturity', label: '부숙도', unit: '', type: 'select', options: MATURITY_OPTIONS, standard: '부숙중기 이상' },
            { key: 'nitrogen', label: '질소(N)', unit: '%', standard: '' },
            { key: 'phosphorus', label: '인산(P₂O₅)', unit: '%', standard: '' },
            { key: 'potassium', label: '칼리(K₂O)', unit: '%', standard: '' },
        ],
        liquid_pig: [
            { key: 'copper', label: '구리(Cu)', unit: 'mg/kg', standard: '70 이하' },
            { key: 'zinc', label: '아연(Zn)', unit: 'mg/kg', standard: '170 이하' },
        ],
    };

    /** 부숙도 순서 (높을수록 잘 부숙됨) */
    /** 부숙도 순서 (높을수록 잘 부숙됨) — MATURITY_GRADES에서 파생한다 */
    const MATURITY_ORDER = Object.freeze(Object.fromEntries(MATURITY_GRADES.map((g, i) => [g, i])));

    /**
     * 레거시 등급 관용. `완전부숙`은 어느 법령에도 없고 양식 5종에도 없어 SLS-1-207에서
     * 선택지에서 뺐다. 배포된 적 없는 기능이라 사용자 데이터에는 존재할 수 없지만,
     * 오래된 백업에서 복원되면 화면 배지는 조회 실패로 '부적합', 내보내기는 '부숙완료'로
     * 정규화되어 **화면과 파일이 어긋난다**. 판정 조회 전에 여기를 통과시킨다.
     */
    const LEGACY_MATURITY = { '완전부숙': '부숙완료' };
    function normalizeMaturity(value) {
        return LEGACY_MATURITY[value] || value;
    }

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

    /**
     * 배출시설 면적 기준 요구 등급.
     * 표기(maturityStandardFor)와 판정(checkCompostFieldStatus)이 **같은 함수에서** 나와야
     * 한다. 따로 두면 등급이 늘어날 때 한쪽만 고쳐져 조용히 어긋난다.
     */
    function requiredMaturityFor(areaSqm) {
        return areaSqm >= 1500 ? '부숙완료' : '부숙중기';
    }

    /** 배출시설 면적 기준 부숙도 요구 등급 표기 */
    function maturityStandardFor(areaSqm) {
        return `${requiredMaturityFor(areaSqm)} 이상`;
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
     *
     * 질소·인산·칼리(AG~AI)는 법정 기준값이 없어 standard를 비운다.
     * ⚠️ checkCompostFieldStatus에 "기준 없는 항목은 배지를 비운다" 가드가 있어야 한다 —
     *    없으면 두 분기를 다 건너뛰어 무조건 초록 ✓(허위 적합)가 찍힌다(SLS-1-200).
     */
    const RESULT_FIELDS = ['moisture', 'maturity', 'copper', 'zinc', 'salinity',
        'nitrogen', 'phosphorus', 'potassium'];

    window.CompostFields = {
        COMPOST_FIELDS, MATURITY_ORDER, MATURITY_OPTIONS, RESULT_FIELDS,
        getFieldsForSample, getAreaInSqm, maturityStandardFor, requiredMaturityFor,
        normalizeMaturity, appliesTo,
    };
})();
