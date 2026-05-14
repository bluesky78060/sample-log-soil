/**
 * @fileoverview JUSO(도로명주소) API 렌더러 측 헬퍼
 * @description Electron main 프로세스의 `juso:search` IPC를 호출하고,
 *              결과를 자동완성 모듈이 사용하는 표준 형태로 변환한다.
 *
 * 원본 호출 로직 차용:
 *   postal-code-finder (MIT License) - bluesky78060
 *   - backend/src/services/providers/jusoPostalCodeService.js
 *   - backend/src/routes/address.js (sanitizeKeyword)
 *
 * 사용:
 *   const r = await window.JusoService.search('봉화군 봉화읍 삼계리');
 *   r.items.forEach(it => console.log(it.roadAddr, it.zipNo));
 */
(function () {
    'use strict';

    // SQL 인젝션 방지 (postal-code-finder routes/address.js 차용)
    // SLS-1-20: defense-in-depth 의도적 중복.
    //   main 카운터파트: src/index.js (sanitizeJusoKeyword + JUSO_SQL_RESERVED/JUSO_BAD_CHARS)
    //   양쪽 sync 필수 — 목록 변경 시 두 파일 동시 수정
    //   renderer 측은 UX(즉시 에러 표시)용, main이 보안 신뢰 경계
    const SQL_RESERVED = [
        'OR', 'SELECT', 'INSERT', 'DELETE', 'UPDATE',
        'CREATE', 'DROP', 'EXEC', 'UNION', 'FETCH',
        'DECLARE', 'TRUNCATE'
    ];
    const BAD_CHARS = /[<>=%]/;

    function sanitizeKeyword(q) {
        const s = String(q || '').trim();
        if (!s) return { ok: false, error: '검색어를 입력해 주세요.' };
        if (s.length > 80) return { ok: false, error: '검색어가 너무 깁니다 (최대 80자).' };
        if (BAD_CHARS.test(s)) return { ok: false, error: '<, >, =, % 문자는 사용할 수 없습니다.' };
        for (const w of SQL_RESERVED) {
            const re = new RegExp(`\\b${w}\\b`, 'i');
            if (re.test(s)) return { ok: false, error: `"${w}" 같은 예약어는 사용할 수 없습니다.` };
        }
        return { ok: true, value: s };
    }

    /**
     * JUSO API 검색 (Electron main 경유)
     * @param {string} keyword - 검색어 (예: "봉화군 봉화읍 삼계리")
     * @param {Object} [options]
     * @param {number} [options.page=1] - 페이지 번호
     * @param {number} [options.size=10] - 페이지 크기 (최대 50)
     * @returns {Promise<{ok: boolean, items?: Array, total?: number, error?: string}>}
     */
    async function search(keyword, options = {}) {
        const chk = sanitizeKeyword(keyword);
        if (!chk.ok) return { ok: false, error: chk.error, items: [], total: 0 };

        if (!window.electronAPI?.jusoSearch) {
            return {
                ok: false,
                error: 'JUSO API는 데스크톱 앱(Electron) 환경에서만 사용 가능합니다.',
                items: [], total: 0
            };
        }

        const page = Math.max(1, Math.min(100, Number(options.page) || 1));
        const size = Math.max(1, Math.min(50, Number(options.size) || 10));

        try {
            const res = await window.electronAPI.jusoSearch({
                keyword: chk.value,
                page,
                size
            });
            if (!res || res.ok === false) {
                return {
                    ok: false,
                    error: res?.error || 'JUSO 호출 실패',
                    items: [], total: 0
                };
            }
            return {
                ok: true,
                items: Array.isArray(res.items) ? res.items : [],
                total: Number(res.total) || 0
            };
        } catch (e) {
            return { ok: false, error: e?.message || 'JUSO 호출 오류', items: [], total: 0 };
        }
    }

    /**
     * JUSO 응답 1건을 자동완성 모듈이 쓰는 표준 객체로 매핑
     * @param {Object} item - results.juso[i]
     * @returns {Object}
     */
    function toAutocompleteEntry(item) {
        // 방어적 가드 (null/잘못된 형태 입력 보호)
        const it = (item && typeof item === 'object') ? item : {};
        return {
            village: it.emdNm || '',
            district: it.sggNm || '',
            region: it.siNm || '',
            regionKey: '__juso__',
            isMountain: false,
            displayText: it.roadAddr || it.jibunAddr || '',
            score: 0,
            // JUSO 원본 필드 보존 (필요 시 사용)
            zipNo: it.zipNo || '',
            roadAddr: it.roadAddr || '',
            jibunAddr: it.jibunAddr || ''
        };
    }

    /**
     * 응답 배열 일괄 매핑
     * @param {Array} items
     * @returns {Array}
     */
    function mapToAutocompleteEntries(items) {
        return (Array.isArray(items) ? items : []).map(toAutocompleteEntry);
    }

    window.JusoService = {
        search,
        sanitizeKeyword,
        toAutocompleteEntry,
        mapToAutocompleteEntries
    };
})();
