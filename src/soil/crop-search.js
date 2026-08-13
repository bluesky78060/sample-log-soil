/**
 * 작물 검색 — 순수 로직 (SLS-1-228)
 *
 * 엑셀 서식에 작물명을 적을 때 정확한 이름을 찾기 위한 조회 기능.
 * CROP_DATA에는 `벼(일반답)` · `벼(염해답-숙답)` · `보리(중북부)` · `보리(남부)`처럼
 * **미리 보지 않으면 무엇을 골라야 할지 모르는** 이름이 많다.
 *
 * ⚠️ 이 모듈은 `window.CROP_DATA`를 **읽지 않는다.** 호출부가 인자로 넘긴다.
 *    작물 데이터는 3계층(번들 → 로컬 파일 → Firestore)으로 런타임에 교체되므로
 *    (`crop-data-loader.js:175-180`이 CROP_DATA와 CROP_CATEGORIES를 **둘 다** 갈아끼운다)
 *    모듈이 로드 시점에 캡처하면 사용자가 업로드한 최신 목록이 반영되지 않는다.
 *
 * 노출: window.CropSearch
 */
(function () {
    'use strict';

    /** 목록에 한 번에 그리는 최대 건수 */
    const DEFAULT_LIMIT = 200;

    /**
     * 검색어 정규화 — 연속 공백을 하나로 줄이고 앞뒤를 제거, 소문자화.
     *
     * ⚠️ 공백을 **전부 없애지는 않는다.** 작물명에는 의미 있는 띄어쓰기가 있어
     *    다 지우면 서로 다른 작물이 같은 문자열로 뭉친다.
     */
    function normalize(s) {
        return String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    /**
     * 작물 목록을 검색어·분류로 거른다.
     *
     * @param {Array<{code:string,name:string,category:string}>} crops
     * @param {Object} [opts]
     * @param {string} [opts.keyword]  이름 또는 코드 부분 일치
     * @param {string} [opts.category] '전체'면 거르지 않음
     * @param {number} [opts.limit]
     * @returns {{items:Array, total:number, truncated:boolean}}
     *          `total`은 **자르기 전** 전체 일치 수다. 자른 뒤 길이를 쓰면
     *          "전체가 200개"로 읽혀 사용자가 자기 작물이 없다고 오해한다.
     */
    function filterCrops(crops, opts = {}) {
        const list = Array.isArray(crops) ? crops : [];
        const kw = normalize(opts.keyword);
        const cat = opts.category || '전체';
        const limit = Number.isFinite(opts.limit) ? opts.limit : DEFAULT_LIMIT;

        const matched = list.filter((c) => {
            if (!c) return false;
            if (cat !== '전체' && c.category !== cat) return false;
            if (!kw) return true;
            // 코드로도 찾는다 — '00021'을 알고 있는 사람이 있다
            return normalize(c.name).includes(kw) || normalize(c.code).includes(kw);
        });

        return {
            items: matched.slice(0, limit),
            total: matched.length,
            truncated: matched.length > limit,
        };
    }

    /** 분류 목록 — 넘어온 게 없으면 작물에서 뽑는다(로더가 교체하기 전 대비) */
    function categoriesOf(crops, categories) {
        if (Array.isArray(categories) && categories.length) return categories.slice();
        return [...new Set((Array.isArray(crops) ? crops : []).map((c) => c?.category).filter(Boolean))];
    }

    window.CropSearch = { filterCrops, categoriesOf, normalize, DEFAULT_LIMIT };
})();
