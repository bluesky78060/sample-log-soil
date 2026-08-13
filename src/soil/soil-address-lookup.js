/**
 * 엑셀 가져오기 — 도로명주소로 우편번호 자동조회 (SLS-1-227)
 *
 * 엑셀에 적은 도로명주소를 JUSO API로 조회해 우편번호를 채운다.
 * 조회에 실패하거나 후보가 모호하면 **채우지 않고** 그 사실을 남긴다 —
 * 가져오기 모달이 그 행을 붉게 표시해 작업자가 직접 고치게 한다.
 *
 * ══════════════════════════════════════════════════════════════════
 * 이 파일의 존재 이유는 "채우는 것"이 아니라 **"함부로 채우지 않는 것"**이다.
 *
 * JUSO는 부분 일치로도 후보를 준다. 첫 후보를 그냥 쓰면 옆 동네 우편번호가
 * 라벨에 찍히고, 그걸 알아채는 사람이 없다. 조용히 틀린 값보다 빈 값이 낫다.
 * (soil-import-address.test.js:66의 원칙과 같다.)
 * ══════════════════════════════════════════════════════════════════
 *
 * ⚠️ Electron 전용 — window.JusoService가 window.electronAPI.jusoSearch를 거친다
 *    (juso-service.js:54). 웹(GitHub Pages)에서는 조회 자체가 불가능하다.
 *
 * 노출: window.SoilAddressLookup
 */
(function () {
    'use strict';

    /** 한 번에 받아올 후보 수. 이보다 total이 크면 "다 못 봤다"고 보고 확정하지 않는다. */
    const PAGE_SIZE = 10;

    /**
     * 호출 간 최소 간격(ms).
     *
     * ⚠️ 250ms가 아니라 300ms인 이유가 있다.
     *    main의 limiter는 sliding window가 아니라 `start` 기준 **고정 1초 창**이고
     *    한도는 5회다 (src/index.js:109-131, EXT_API_MAX_CALLS_PER_SEC).
     *    250ms면 0·250·500·750·1000 → 한 창에 정확히 5회로 **여유가 0**이다.
     *    300ms면 0·300·600·900 → 4회, 1200에서 창이 리셋된다.
     */
    const INTERVAL_MS = 300;

    /**
     * rate limit 거절 후 대기(ms). 창이 리셋되려면 1초가 지나야 하므로 여유를 둔다.
     *
     * ⚠️ 거절된 호출도 limiter의 count를 올린다(index.js:124).
     *    즉시 재시도하면 창을 더 채워 상황이 나빠진다. 반드시 기다린다.
     */
    const RETRY_WAIT_MS = 1100;
    const MAX_RETRY = 2;

    /** rate limit 거절 판별용 — main이 돌려주는 문구(index.js:1125) */
    const RATE_LIMIT_HINT = '너무 빈번';

    /**
     * 도로명 정규화 — 연속 공백 접기 + 앞뒤 제거.
     *
     * ⚠️ **이 이상 하지 않는다.** 하이픈·괄호·번지 표기까지 지우면 서로 다른 주소가
     *    "완전일치"로 뭉쳐, 아래 단일-완전일치 방어가 통째로 무너진다.
     *    느슨한 정규화는 조용히 틀린 우편번호를 만든다.
     */
    function normalizeRoad(s) {
        return String(s || '').replace(/\s+/g, ' ').trim();
    }

    /** 앱 전체가 5자리만 우편번호로 인정한다 (soil-result-importer.js:376-384) */
    function isValidZip(z) {
        return /^\d{5}$/.test(String(z || '').trim());
    }

    /**
     * 조회 응답 → 판정.
     *
     * ⚠️ `items`가 아니라 **응답 객체 통째로** 받는다.
     *    `items`만 넘기면 `total`을 볼 수 없고, `items` 1건 · `total` 3건인 상황에서
     *    첫 후보를 확정해 버린다. 그게 이 기능에서 제일 위험한 실패다.
     *
     * @param {string} query 엑셀에 적힌 도로명주소
     * @param {{ok:boolean, items?:Array, total?:number, error?:string}} res
     * @returns {{status:'ok'|'notfound'|'ambiguous'|'error', zip:string, road:string, reason:string}}
     */
    function classifyResult(query, res) {
        const fail = (status, reason) => ({ status, zip: '', road: '', reason });

        if (!res || res.ok === false) {
            return fail('error', res?.error || '조회에 실패했습니다.');
        }

        const items = Array.isArray(res.items) ? res.items : [];
        if (items.length === 0) return fail('notfound', '검색 결과가 없습니다.');

        // 후보를 전부 보지 못했으면 확정하지 않는다.
        // total은 JUSO의 common.totalCount 원본이다 (index.js:1211).
        const total = Number(res.total);
        if (Number.isFinite(total) && total > items.length) {
            return fail('ambiguous', `후보가 ${total}건이라 자동 선택하지 않았습니다. 주소를 더 자세히 적어 주세요.`);
        }

        const q = normalizeRoad(query);
        const exact = items.filter((it) => normalizeRoad(it?.roadAddr) === q);

        let picked;
        if (exact.length === 1) {
            picked = exact[0];
        } else if (exact.length > 1) {
            return fail('ambiguous', `완전히 같은 주소가 ${exact.length}건입니다. 직접 확인해 주세요.`);
        } else if (items.length === 1) {
            picked = items[0];
        } else {
            return fail('ambiguous', `후보가 ${items.length}건입니다. 주소를 더 자세히 적어 주세요.`);
        }

        // 단일 후보라도 값이 성한지 본다 — JusoService는 원본을 그대로 넘기고
        // 빈 값도 막지 않는다 (juso-service.js:79-81).
        const zip = String(picked?.zipNo || '').trim();
        const road = String(picked?.roadAddr || '').trim();
        if (!isValidZip(zip) || !road) {
            return fail('error', '조회 결과에 우편번호나 도로명주소가 없습니다.');
        }

        return { status: 'ok', zip, road, reason: '' };
    }

    /** 이 환경에서 조회가 가능한가 — 불가능하면 사유를 돌려준다 */
    function unavailableReason() {
        if (!window.electronAPI?.jusoSearch) {
            return '주소 자동조회는 데스크톱 앱에서만 사용할 수 있습니다.';
        }
        if (!window.JusoService || typeof window.JusoService.search !== 'function') {
            return '주소 조회 모듈을 불러오지 못했습니다.';
        }
        return '';
    }

    /**
     * 더 두드려도 결과가 같은 실패인가.
     *
     * 키 미설정처럼 환경 자체가 문제면 200행을 두드려도 전부 같은 오류다.
     * 그런 건 첫 행에서 멈추고 같은 사유를 나머지에 붙인다.
     */
    function isFatalError(reason) {
        const s = String(reason || '');
        return s.includes('JUSO_API_KEY') || s.includes('데스크톱 앱') || s.includes('조회 모듈');
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    /**
     * 한 건 조회 — rate limit 거절은 기다렸다 다시 시도한다.
     *
     * ⚠️ limiter의 카운터는 **채널 단위로 앱 전체가 공유**한다.
     *    사용자가 동시에 주소 자동완성을 쓰면(autocomplete-manager.js:447) 같은 창에 얹힌다.
     *    그 거절을 오류로 확정하면 **아무 잘못 없는 행이 붉게 된다.**
     */
    async function lookupOne(query, opts = {}) {
        const search = opts.search || ((k, o) => window.JusoService.search(k, o));
        const wait = opts.sleep || sleep;

        for (let attempt = 0; ; attempt++) {
            const res = await search(query, { size: PAGE_SIZE });
            const rateLimited = res && res.ok === false && String(res.error || '').includes(RATE_LIMIT_HINT);
            if (!rateLimited || attempt >= MAX_RETRY) return classifyResult(query, res);
            await wait(RETRY_WAIT_MS);
        }
    }

    /**
     * 여러 건 일괄 조회.
     *
     * @param {string[]} queries 도로명주소 목록 (중복 포함 가능)
     * @param {Object} [opts]
     * @param {Map} [opts.cache] 정규화 주소 → 결과. **호출자가 소유한다** —
     *        미리보기가 재계산돼도 살아남아야 하고, 캐시가 곧 저장소이기 때문이다.
     * @param {(done:number, total:number)=>void} [opts.onProgress]
     * @param {AbortSignal} [opts.signal] 취소. 취소해도 그때까지 채운 것은 남는다.
     * @returns {Promise<{cache:Map, done:number, aborted:boolean, fatal:string}>}
     */
    async function lookupBatch(queries, opts = {}) {
        const cache = opts.cache instanceof Map ? opts.cache : new Map();
        const wait = opts.sleep || sleep;
        const signal = opts.signal;

        const blocked = unavailableReason();

        // 조회할 것만 추린다 — 같은 주소는 한 번만, 캐시에 있으면 건너뛴다.
        const pending = [];
        const seen = new Set();
        for (const q of queries) {
            const key = normalizeRoad(q);
            if (!key || seen.has(key)) continue;
            // ⚠️ **성공한 것만** 건너뛴다. 실패까지 캐시로 막으면 버튼에는 "N건"이 뜨는데
            //    눌러도 조회가 일어나지 않아 먹통으로 보인다. 일시적 네트워크 오류나
            //    rate limit으로 실패한 건을 작업자가 다시 시도할 길이 없어진다.
            if (cache.get(key)?.status === 'ok') continue;
            seen.add(key);
            pending.push({ key, query: q });
        }

        // 환경이 안 되면 두드리지 않는다. 사유는 전부에 붙인다.
        if (blocked) {
            for (const { key } of pending) {
                cache.set(key, { status: 'error', zip: '', road: '', reason: blocked });
            }
            return { cache, done: pending.length, aborted: false, fatal: blocked };
        }

        let done = 0;
        let fatal = '';
        for (let i = 0; i < pending.length; i++) {
            if (signal?.aborted) return { cache, done, aborted: true, fatal };
            if (i > 0) {
                await wait(INTERVAL_MS);
                if (signal?.aborted) return { cache, done, aborted: true, fatal };
            }

            const { key, query } = pending[i];
            let r;
            try {
                r = await lookupOne(query, opts);
            } catch (err) {
                r = { status: 'error', zip: '', road: '', reason: err?.message || '조회 중 오류가 발생했습니다.' };
            }
            cache.set(key, r);
            // ⚠️ 성공하면 rec의 도로명이 JUSO 표기로 바뀐다(applyAddrLookup).
            //    그 뒤 미리보기가 재계산되면 렌더는 **바뀐 표기로** 상태를 찾는데,
            //    맵에는 사용자가 적은 원래 표기만 있어 못 찾는다.
            //    지금은 "못 찾음 = 붉지 않음"이라 화면은 맞지만 그건 우연이다 —
            //    성공 행에 표시를 하나 붙이는 순간 조용히 동작하지 않는다.
            //    두 표기 모두로 키를 걸어 그 우연을 없앤다.
            if (r.status === 'ok' && r.road) {
                const officialKey = normalizeRoad(r.road);
                if (officialKey !== key) cache.set(officialKey, r);
            }
            done++;
            opts.onProgress?.(done, pending.length);

            // 환경 문제면 나머지도 같은 결과다 — 두드리지 않고 같은 사유를 붙인다.
            if (r.status === 'error' && isFatalError(r.reason)) {
                fatal = r.reason;
                for (let j = i + 1; j < pending.length; j++) {
                    cache.set(pending[j].key, { status: 'error', zip: '', road: '', reason: r.reason });
                }
                done = pending.length;
                opts.onProgress?.(done, pending.length);
                break;
            }
        }

        return { cache, done, aborted: false, fatal };
    }

    window.SoilAddressLookup = {
        normalizeRoad,
        classifyResult,
        lookupOne,
        lookupBatch,
        unavailableReason,
        isValidZip,
        isFatalError,
        INTERVAL_MS,
        RETRY_WAIT_MS,
        MAX_RETRY,
        PAGE_SIZE,
    };
})();
