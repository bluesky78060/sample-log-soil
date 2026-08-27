/**
 * 열이 늘고 줄어도 **보던 열이 화면에서 같은 자리에 남게** 한다 (SLS-1-278).
 *
 * 🚨 무엇이 문제였나
 *    '전체 보기'를 켜면 숨겨 둔 열이 나타나는데, 그 자리가 **맨 뒤가 아니다.**
 *    토양은 경지구분이 목적과 성명 사이, 우편번호가 성명 뒤에 끼어든다. 그러면
 *    그 뒤의 모든 일반 열이 오른쪽으로 밀리는데 `scrollLeft`는 그대로다 —
 *    **보던 자리가 갑자기 다른 열을 가리킨다.**
 *    실측(1280×800, 가로 250px 민 상태): 주소부터 발송일자까지 전부 +150~151px.
 *
 * 🚨 왜 일반 열만 기준이 되는가
 *    왼쪽 고정 열은 쓸 수 없다. 성명은 `sticky-col`이라 전체 보기에서 좌표 자체가
 *    365→435로 바뀐다(실측 +76px). 그건 **스크롤로 되돌릴 수 있는 종류의 이동이
 *    아니다.** 오른쪽 고정(관리)은 `right: 0`이라 언제나 제자리다.
 *
 * 🚨 `position`으로 판별하면 안 된다
 *    `.data-table thead th`가 통째로 `position: sticky`다(세로 고정, `top: 0`).
 *    실측에서 **모든 머리글 칸이 sticky로 나왔다.** 가로로 걸려 있는지는
 *    `left`/`right`가 `auto`인지로만 알 수 있다.
 *
 * 🚨 후보를 하나만 잡으면 안 된다
 *    전체 보기를 **끌 때** 첫 일반 열은 우편번호인데 그 열이 바로 사라진다.
 *    바뀌기 전에 보이던 후보들을 순서대로 담아 두고, 보정할 때 **여전히 보이는
 *    첫 열**을 쓴다. 일반 열은 전부 같은 양만큼 움직이므로 하나면 충분하다.
 */
(function () {
    'use strict';

    /**
     * 가로로 걸려 있는 칸인가. 왼쪽 고정(`left`)과 오른쪽 고정(`right`) 둘 다 뺀다.
     * @param {CSSStyleDeclaration} cs
     * @returns {boolean}
     */
    function isHorizontallyStuck(cs) {
        return cs.left !== 'auto' || cs.right !== 'auto';
    }

    /**
     * 열 구성을 바꾸기 **전에** 부른다. 돌려받은 함수를 바꾼 **뒤에** 부르면
     * 보던 열이 화면에서 같은 자리에 남는다.
     *
     * @param {HTMLTableElement|null} table 목록 표
     * @returns {() => number} 실제로 보정한 픽셀. 보정할 것이 없었으면 0
     */
    function captureColumnAnchor(table) {
        const noop = () => 0;
        if (!table || !table.tHead) return noop;

        // 🚨 스크롤은 표가 아니라 감싼 칸의 것이다 (codex 플랜 리뷰 지적).
        //    `table.scrollLeft`를 건드리면 아무 일도 일어나지 않는다.
        const wrapper = table.closest('.table-wrapper');
        if (!wrapper) return noop;

        const head = table.tHead.rows[0];
        if (!head) return noop;

        const startScrollLeft = wrapper.scrollLeft;
        const wrapRect = wrapper.getBoundingClientRect();

        // 왼쪽 고정 열이 덮고 있는 영역의 오른쪽 끝. 그 왼쪽은 사용자에게 안 보인다.
        let coveredUntil = wrapRect.left;
        for (const th of head.cells) {
            const cs = window.getComputedStyle(th);
            if (cs.display === 'none') continue;
            if (cs.left !== 'auto' && cs.right === 'auto') {
                coveredUntil = Math.max(coveredUntil, th.getBoundingClientRect().right);
            }
        }

        /** @type {Array<{th: HTMLTableCellElement, left: number}>} */
        const anchors = [];
        for (const th of head.cells) {
            const cs = window.getComputedStyle(th);
            if (cs.display === 'none') continue;
            if (isHorizontallyStuck(cs)) continue;

            // 🚨 **지금 화면에 보이는** 열만 기준이 된다 (SLS-1-279).
            //
            //    처음에는 표의 첫 일반 열을 그냥 썼다. 그때는 일반 열이 전부 같은 양만큼
            //    움직여서(실측 +151px) 어느 것을 잡아도 결과가 같았다.
            //
            //    **남는 폭을 흡수하는 열이 생기면서 그 전제가 깨졌다.** 그 열은 자기 폭이
            //    변하므로, 앞에 있는 열과 뒤에 있는 열의 이동량이 서로 다르다.
            //    앞의 열을 기준으로 삼으면 뒤를 보고 있던 사용자의 화면이 어긋난다
            //    (E2E 실측: 128px). 사용자가 실제로 보고 있는 열을 잡아야 한다.
            //    ⚠️ 고정 열에 **일부만** 가린 열은 후보로 남긴다. 오른쪽 끝자락이라도
            //       보이면 사용자에게 보이는 것이고, 어차피 같은 무리의 열은 이동량이
            //       같아 결과가 다르지 않다 (codex 코드 리뷰에서 확인).
            //    ⚠️ 화면 밖 열에서 `break`하지 않는다 — DOM 순서와 화면 좌→우 순서가
            //       늘 같다는 전제에 기대게 된다. 22열을 끝까지 보는 비용은 무시할 만하다.
            const rect = th.getBoundingClientRect();
            if (rect.right <= coveredUntil + 1) continue;   // 고정 열에 온전히 가려진 자리
            if (rect.left >= wrapRect.right) continue;      // 화면 오른쪽 바깥

            anchors.push({ th, left: rect.left });
        }
        if (anchors.length === 0) return noop;

        return function restoreColumnAnchor() {
            for (const { th, left } of anchors) {
                // 바뀌면서 사라진 열은 건너뛴다 (전체 보기를 끌 때의 우편번호 등)
                if (window.getComputedStyle(th).display === 'none') continue;

                const shift = Math.round(th.getBoundingClientRect().left - left);
                if (!shift) return 0;

                // 🚨 왼쪽 영역을 보고 있었다면 되돌리지 않는다 (E2E가 잡아낸 것).
                //
                //    '전체 보기'를 켜는 사람은 **숨어 있던 열을 보려는 것**이다.
                //    그 열들은 표 왼쪽(고정 열 근처)에 나타나는데, 거기서 스크롤을
                //    150px 밀어 "보던 자리를 지켜" 주면 **사용자가 보려던 바로 그
                //    열을 화면 밖으로 밀어낸다.**
                //
                //    경계는 `shift`다 — 새로 나타난 열이 차지한 폭이다. 그만큼도
                //    밀어 두지 않았다면 아직 그 구간을 보고 있던 것이다.
                //    (`=== 0`만 예외로 두면 1px 민 상태에서도 150px 튄다 —
                //     codex 코드 리뷰 지적.)
                //
                //    열이 **줄 때**(shift < 0)는 따진 필요가 없다. 보던 것이 왼쪽으로
                //    밀리므로 언제나 따라가는 것이 옳고, 넘치면 브라우저가 0으로 잘라 준다.
                if (shift > 0 && startScrollLeft < shift) return 0;

                wrapper.scrollLeft += shift;
                return shift;
            }
            return 0;
        };
    }

    window.captureColumnAnchor = captureColumnAnchor;
})();
