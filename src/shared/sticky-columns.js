/**
 * 목록 표의 왼쪽 고정 열 좌표를 화면에서 재서 맞춘다 (SLS-1-264).
 *
 * 🚨 왜 필요한가
 *    CSS의 `left` 값은 손으로 계산한 추정치였다. 실제 렌더링 폭과 다르면
 *    고정 열이 제 자리보다 오른쪽에서 시작하고, 가로로 밀 때 지정 좌표에 닿을
 *    때까지 **따라 밀린다.** 토양 목록에서 성명이 45px까지 밀렸다
 *    (접수일자를 90px로 잡아 뒀는데 `2026-08-20`이 들어가면 107px가 된다).
 *
 * 🚨 왜 offsetLeft인가 — 폭을 더하지 않는다
 *    `offsetWidth`는 이미 정수로 반올림된 값이라(완료 열 49 vs 실제 49.5)
 *    여러 열을 더하면 오차가 쌓인다. `offsetLeft`는 **더하지 않고 직접 재는**
 *    값이라 누적이 없다.
 *
 *    `getBoundingClientRect()`는 쓰지 않는다 — **transform의 영향을 받는다.**
 *    SLS-1-263에서 화면 전환 효과(scale 0.8→1) 때문에 0.3초 동안 모든 폭이
 *    0.844배로 찍혔다. 그 효과는 제거했지만, 레이아웃 값을 쓰면 앞으로 비슷한
 *    것이 생겨도 영향을 받지 않는다.
 *
 * 🚨 왜 행마다 인라인 스타일을 쓰지 않는가
 *    목록은 수천 행이 될 수 있다. 행마다 쓰면 `행 × 열`번의 쓰기다.
 *    규칙은 열당 하나면 되고, 행이 늘어도 비용이 그대로다.
 *    CSP `style-src`에 `'unsafe-inline'`이 있어 허용된다.
 *
 * ⚠️ 기존 CSS의 `left` 값은 **일부러 남겨 두었다.** 이 스크립트가 안 돌아도
 *    예전 동작(약간 밀리지만 쓸 수 있는 상태)이 유지된다. 자동 계산이 잘못되면
 *    호출 한 줄만 빼면 즉시 되돌아간다.
 */
(function () {
    'use strict';

    /** 표 id → 그 표 전용 <style> */
    const sheets = new Map();
    /** 표별 rAF 예약 — 하나로 두면 표가 둘일 때 서로 취소한다 */
    const scheduled = new WeakMap();
    /** 이미 관측 중인 표. **WeakSet이어야 한다** — 표가 다시 만들어지면
     *  일반 Set은 옛 표를 계속 붙들어 수거를 막는다 (codex 코드 리뷰 지적). */
    const watched = new WeakSet();

    function sheetFor(table) {
        let el = sheets.get(table.id);
        if (!el || !el.isConnected) {
            el = document.createElement('style');
            // 표가 둘 이상일 때 하나를 공유하면 마지막 표의 규칙만 남는다.
            el.dataset.stickyFor = table.id;
            document.head.appendChild(el);
            sheets.set(table.id, el);
        }
        return el;
    }

    /**
     * 고정 열들의 좌표를 계산해 규칙 문자열로 만든다.
     * DOM을 읽기만 한다 — 시험에서 가짜 머리글로 검증할 수 있게 분리했다.
     *
     * @param {HTMLTableElement} table id가 있어야 한다 (선택자 특이도에 쓴다)
     * @returns {string} 예: `#logTable .col-num{left:89px}`
     */
    function buildRules(table) {
        const head = table.tHead && table.tHead.rows[0];
        if (!head || !table.id) return '';   // id는 ensureId가 채워 준다

        const rules = [];
        let base = null;

        for (const th of head.cells) {
            if (!th.classList.contains('sticky-col')) continue;
            // 숨겨진 열 — 자리를 차지하지 않으므로 좌표에서 빠져야 한다
            // (경지구분 숨김 SLS-1-261, 공익직불제 탭의 목적 숨김 등)
            if (th.offsetWidth === 0) continue;
            const cs = getComputedStyle(th);
            // 오른쪽 고정(관리 열, SLS-1-260)은 `right: 0`이라 왼쪽 누적과 무관하다
            if (cs.right !== 'auto') continue;
            // 🚨 고정이 **풀린** 열에는 왼쪽 좌표를 주면 안 된다 (SLS-1-275).
            //    관리 열은 1024px(퇴비 1200px) 이하에서 `position: static; right: auto`가
            //    된다. 그 상태로 재면 오른쪽 고정 열인데도 위 검사를 통과해
            //    `col-action{left:900px}` 같은 규칙이 붙는다. static일 땐 무해하지만
            //    **창을 다시 넓히면** 그 열은 `right:0`과 `left:900px`를 함께 갖는다 —
            //    왼쪽 제약이 이겨 관리 열이 오른쪽 끝에서 떨어진다.
            //    화면 폭이 바뀌어도 표 폭은 그대로일 수 있어 관측자가 안 불릴 수
            //    있으므로(그럼 잘못된 규칙이 그대로 남는다) 애초에 만들지 않는다.
            //    `-webkit-sticky`도 받는다 — 구형 WebKit은 computed value를 그대로
            //    돌려준다. 여기서 걸러 버리면 **규칙이 하나도 안 만들어지는데
            //    오류도 안 나고**(폴백 CSS로 화면은 그럴듯하다) 밀림만 되살아난다.
            if (cs.position !== 'sticky' && cs.position !== '-webkit-sticky') continue;

            const cls = Array.from(th.classList).find((c) => c.startsWith('col-'));
            if (!cls) continue;

            if (base === null) base = th.offsetLeft;
            rules.push(`#${table.id} .${cls}{left:${th.offsetLeft - base}px}`);
        }
        return rules.join('');
    }

    /**
     * 선택자에 쓸 id를 보장한다.
     *
     * ⚠️ 없으면 그냥 넘어가게 두면 안 된다. 실제로 퇴비 표에 id가 없어
     *    **아무 규칙도 안 만들어지는데 오류도 안 나는** 상태였다(2026-08-20).
     *    화면은 멀쩡해 보이고(기존 CSS 폴백) 밀림만 그대로 남는다.
     */
    let autoId = 0;
    function ensureId(table) {
        if (!table.id) table.id = `sticky-table-${++autoId}`;
        return table.id;
    }

    /**
     * 지금 화면 상태로 좌표를 다시 맞춘다.
     * @param {HTMLTableElement|null} table
     */
    function applyStickyColumns(table) {
        if (!table || !table.tHead) return;
        ensureId(table);
        // 표가 화면에 없으면(뷰 전환 전 등) 폭이 0이라 재 봐야 의미가 없다.
        if (table.offsetWidth === 0) return;

        // 🚨 재기 전에 **이 모듈이 넣은 좌표를 먼저 끈다** (SLS-1-275).
        //
        //    `offsetLeft`는 그 요소의 sticky 변위를 **포함한다**. 직전 규칙이
        //    지금의 자연 위치보다 큰 left를 걸어 두었으면 요소가 오른쪽으로 밀려
        //    있고, 그 밀린 자리를 다시 읽어 **같은 값을 다시 쓴다.** 한 번 어긋나면
        //    스스로 그 값에 고정돼(latch) 새로 고치기 전까지 풀리지 않는다.
        //
        //    열이 **줄어드는** 전환에서만 터진다 — 공익직불제→농가의뢰(차수 제거),
        //    전체 보기 해제(경지구분 제거). 늘어나는 쪽은 직전 값이 더 작아
        //    변위가 안 생기므로 멀쩡하다. 그래서 왕복하지 않는 시험은 못 잡았다.
        //    실측(1440×900): 농가의뢰로 돌아오면 접수일자 163px → 225px,
        //    62px 틈이 생기고 그만큼 밀린 셀이 `구분`을 덮었다.
        //
        //    `left:auto`면 sticky가 가로로 걸리지 않아 자연 위치가 읽힌다.
        //    `#id .sticky-col`(1,1,0)이 CSS 폴백 `.data-table.gongik-on .col-date`
        //    (0,3,0)도 이기므로 폴백이 만든 변위까지 함께 걷힌다.
        //    오른쪽 고정(관리 열)은 `right`를 안 건드리므로 그대로다.
        //
        //    덤: 가로로 민 상태에서 관측자가 불려도 변위가 섞이지 않는다.
        //
        // ⚠️ 두 쓰기는 **같은 태스크 안에서** 끝나야 한다. 사이에 페인트가 없어야
        //    깜빡이지 않는다 — 중간에 await·rAF를 끼워 넣지 마라.
        // ⚠️ **순서를 한 줄씩 나눠 쓴다.** 한 줄로 붙여 놓으면
        //    `sheet.textContent = buildRules(table)`가 리셋을 덮어쓴 뒤에 재는 것처럼
        //    읽힌다(실제로 코드 리뷰에서 그렇게 오독됐다). 인자가 먼저 평가되므로
        //    동작은 같지만, 재는 시점이 눈에 보이는 편이 낫다.
        const sheet = sheetFor(table);
        sheet.textContent = `#${table.id} .sticky-col{left:auto}`;
        const rules = buildRules(table);   // ← 위 리셋이 걸린 상태에서 잰다
        sheet.textContent = rules;

        // 표 폭이 달라지면 다시 맞춘다. `window.resize`로는 부족하다 —
        // 열이 숨겨지거나 내용이 바뀌어 폭이 달라지는 경우를 못 잡는다.
        if (watched.has(table)) return;
        watched.add(table);

        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(() => scheduleStickyColumns(table)).observe(table);
        }
        // ⚠️ ResizeObserver만으로는 부족하다 (codex 코드 리뷰 지적).
        //    열이 숨겨지거나 나타나도 **표 전체 폭은 그대로일 수 있다.**
        //    이 앱에서 열 구성을 바꾸는 것은 표의 class다
        //    (`full-view` 전체 보기, `gongik-on` 공익직불제 탭).
        //    호출을 한 군데 빠뜨려도 여기서 잡힌다.
        if (typeof MutationObserver !== 'undefined') {
            new MutationObserver(() => scheduleStickyColumns(table))
                .observe(table, { attributes: true, attributeFilter: ['class'] });
        }
    }

    /**
     * 렌더·토글·관측자가 겹쳐 불릴 수 있으므로 한 프레임에 한 번으로 묶는다.
     * @param {HTMLTableElement|null} table
     */
    function scheduleStickyColumns(table) {
        if (!table || typeof table !== 'object') return;
        const prev = scheduled.get(table);
        if (prev) cancelAnimationFrame(prev);
        scheduled.set(table, requestAnimationFrame(() => {
            scheduled.delete(table);
            applyStickyColumns(table);
        }));
    }

    window.applyStickyColumns = applyStickyColumns;
    window.scheduleStickyColumns = scheduleStickyColumns;
    window.buildStickyColumnRules = buildRules;   // 시험용
})();
