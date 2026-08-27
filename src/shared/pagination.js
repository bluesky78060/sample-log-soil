// ========================================
// 공통 페이지네이션 모듈
// ========================================
(function() {
    'use strict';

    /**
     * 페이지네이션 관리자 클래스
     */
    class PaginationManager {
        /**
         * @param {object} options - 설정 옵션
         * @param {string} options.storageKey - localStorage 키 (예: 'soilItemsPerPage')
         * @param {number} options.defaultItemsPerPage - 기본 페이지당 항목 수 (기본값: 100)
         * @param {function} options.onPageChange - 페이지 변경 시 콜백
         * @param {function} options.renderRow - 행 렌더링 함수
         */
        constructor(options) {
            this.storageKey = options.storageKey;
            this.defaultItemsPerPage = options.defaultItemsPerPage || 100;
            this.onPageChange = options.onPageChange || (() => {});
            this.renderRow = options.renderRow;

            this.currentPage = 1;
            this.itemsPerPage = parseInt(localStorage.getItem(this.storageKey), 10) || this.defaultItemsPerPage;
            this.totalPages = 1;
            this.data = [];

            // DOM 요소
            this.elements = {
                paginationInfo: document.getElementById('paginationInfo'),
                itemsPerPageSelect: document.getElementById('itemsPerPage'),
                pageNumbersContainer: document.getElementById('pageNumbers'),
                firstPageBtn: document.getElementById('firstPage'),
                prevPageBtn: document.getElementById('prevPage'),
                nextPageBtn: document.getElementById('nextPage'),
                lastPageBtn: document.getElementById('lastPage'),
                paginationContainer: document.getElementById('pagination'),
                tableBody: null,
                emptyState: null
            };

            this.init();
        }

        /**
         * 테이블 바디와 빈 상태 요소 설정
         */
        setTableElements(tableBody, emptyState) {
            this.elements.tableBody = tableBody;
            this.elements.emptyState = emptyState;
        }

        /**
         * 초기화
         */
        init() {
            const { itemsPerPageSelect, firstPageBtn, prevPageBtn, nextPageBtn, lastPageBtn } = this.elements;

            // 페이지당 항목 수 선택 이벤트
            if (itemsPerPageSelect) {
                itemsPerPageSelect.value = this.itemsPerPage;
                itemsPerPageSelect.addEventListener('change', (e) => {
                    this.itemsPerPage = parseInt(e.target.value, 10);
                    localStorage.setItem(this.storageKey, this.itemsPerPage);
                    this.currentPage = 1;
                    this.renderCurrentPage();
                });
            }

            // 네비게이션 버튼 이벤트
            if (firstPageBtn) firstPageBtn.addEventListener('click', () => this.goToPage(1));
            if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
            if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
            if (lastPageBtn) lastPageBtn.addEventListener('click', () => this.goToPage(this.totalPages));
        }

        /**
         * 페이지 이동
         */
        goToPage(page) {
            if (page < 1 || page > this.totalPages) return;
            const direction = Math.sign(page - this.currentPage);
            this.currentPage = page;
            this.renderCurrentPage(direction);

            // 테이블 상단으로 스크롤
            // ⚠️ `behavior: 'smooth'`는 쓰지 않는다 — 표 안쪽 스크롤을 부드럽게 하면
            //    새 행이 이미 그려진 채 옛 위치에서 천천히 올라와 반응이 늦게 느껴진다.
            const tableWrapper = document.querySelector('.table-wrapper');
            if (tableWrapper) tableWrapper.scrollTop = 0;
        }

        /**
         * 데이터 설정 및 렌더링
         */
        setData(data) {
            this.data = data;
            this.totalPages = Math.ceil(this.data.length / this.itemsPerPage) || 1;

            // 필터 변경 등으로 데이터가 줄면 항상 1페이지부터 시작
            if (this.currentPage > this.totalPages) {
                this.currentPage = 1;
            }

            this.render();
        }

        /**
         * 전체 렌더링
         */
        render() {
            const { paginationContainer, emptyState } = this.elements;

            if (this.data.length === 0) {
                const { tableBody } = this.elements;
                if (tableBody) tableBody.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
                if (paginationContainer) paginationContainer.style.display = 'none';
                this.updatePaginationUI();
                return;
            }

            if (emptyState) emptyState.style.display = 'none';
            if (paginationContainer) paginationContainer.style.display = 'flex';

            this.renderCurrentPage();
        }

        /**
         * 현재 페이지 렌더링
         * @param {number} direction 넘어온 방향 (1=다음, -1=이전, 0=방향 없음)
         */
        renderCurrentPage(direction = 0) {
            const { tableBody } = this.elements;
            if (!tableBody) return;

            // 🚨 채움 행을 판단하기 전에 페이지 수를 다시 센다 (SLS-1-276).
            //    페이지당 항목 수를 바꾸는 경로는 `currentPage`만 1로 되돌리고
            //    `totalPages`는 그대로 둔 채 여기로 들어온다. 100 → 20으로 줄이면
            //    옛 값(1)이 남아 채우지 않고, 20 → 100으로 늘리면 옛 값(2)이 남아
            //    **한 페이지뿐인데 빈 줄 75개를 넣는다.**
            this.totalPages = Math.ceil(this.data.length / this.itemsPerPage) || 1;

            const startIndex = (this.currentPage - 1) * this.itemsPerPage;
            const endIndex = startIndex + this.itemsPerPage;
            const pageData = this.data.slice(startIndex, endIndex);

            // 조각에 모아 **한 번에** 붙인다 (SLS-1-276).
            // 예전에는 innerHTML로 비운 뒤 행마다 appendChild 해서, 그 사이 표가 빈 채로
            // 잡혔다.
            const fragment = document.createDocumentFragment();

            // 🚨 실제로 붙은 행을 센다. `renderRow`는 **null을 돌려줄 수 있고**
            //    그러면 그 항목은 행이 되지 않는다. `pageData.length`로 채우면
            //    빠진 만큼 표가 짧아진다 (codex 코드 리뷰 지적).
            let renderedRows = 0;
            if (this.renderRow) {
                pageData.forEach((item, index) => {
                    const row = this.renderRow(item, startIndex + index);
                    if (row) {
                        fragment.appendChild(row);
                        renderedRows++;
                    }
                });
            }

            // 마지막 페이지가 짧아도 표 높이를 지킨다 — 아래 페이지 단추가 따라 올라오지 않게.
            // ⚠️ 페이지가 하나뿐이면 채우지 않는다. 5건인데 페이지당 100건이면 빈 줄 95개다.
            if (this.totalPages > 1) {
                const columnCount = this.getColumnCount();
                for (let i = renderedRows; i < this.itemsPerPage; i++) {
                    fragment.appendChild(this.buildFillerRow(columnCount));
                }
            }

            tableBody.replaceChildren(fragment);
            this.playPageTransition(direction);

            this.updatePaginationUI();
            this.onPageChange(this.currentPage, pageData);
        }

        /**
         * 지금 화면에 보이는 열 수. 숨긴 열은 빼고 센다.
         *
         * 🚨 폭(`offsetWidth`)으로 재면 안 된다 — 이 함수는 목록을 다시 그리는 도중에
         *    불리는데, tbody가 비면 표가 통째로 폭 0으로 접혀 보이는 열이 하나도 없다고
         *    나온다. 계산된 `display`는 레이아웃과 무관하게 옳은 값을 준다.
         * @returns {number}
         */
        getColumnCount() {
            const head = this.elements.tableBody?.closest('table')?.tHead?.rows[0];
            if (!head) return 1;
            let count = 0;
            for (const th of head.cells) {
                if (window.getComputedStyle(th).display !== 'none') count++;
            }
            return count || 1;
        }

        /**
         * 마지막 페이지가 짧을 때 높이를 채우는 빈 줄.
         *
         * 🚨 체크박스도 `data-id`도 넣지 않는다 — 전체 선택·삭제·내보내기가
         *    `.row-checkbox`로 행을 찾으므로 섞이면 처리 대상이 늘어난다.
         * @param {number} columnCount
         * @returns {HTMLTableRowElement}
         */
        buildFillerRow(columnCount) {
            const tr = document.createElement('tr');
            tr.className = 'page-filler';
            tr.setAttribute('aria-hidden', 'true');   // 스크린리더가 빈 줄을 읽지 않게
            const td = document.createElement('td');
            td.colSpan = columnCount;
            td.textContent = ' ';                 // 데이터 행과 같은 높이를 갖게 한다
            tr.appendChild(td);
            return tr;
        }

        /**
         * 넘긴 방향으로 짧게 밀어 넣는다.
         *
         * 🚨 클래스를 지웠다가 다시 붙이는 사이에 리플로우를 한 번 강제해야 한다.
         *    같은 방향을 연달아 누르면(1→2→3) 클래스에 변화가 없어 애니메이션이
         *    두 번째부터 재생되지 않는다.
         * @param {number} direction
         */
        playPageTransition(direction) {
            const { tableBody } = this.elements;
            if (!direction || !tableBody) return;
            tableBody.classList.remove('page-in-next', 'page-in-prev');
            void tableBody.offsetWidth;
            tableBody.classList.add(direction > 0 ? 'page-in-next' : 'page-in-prev');
        }

        /**
         * 페이지네이션 UI 업데이트
         */
        updatePaginationUI() {
            const { paginationInfo, firstPageBtn, prevPageBtn, nextPageBtn, lastPageBtn } = this.elements;

            const totalItems = this.data.length;
            this.totalPages = Math.ceil(totalItems / this.itemsPerPage) || 1;

            if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

            const startItem = totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
            const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

            if (paginationInfo) {
                paginationInfo.textContent = `${totalItems}건 중 ${startItem}-${endItem}`;
            }

            if (firstPageBtn) firstPageBtn.disabled = this.currentPage === 1;
            if (prevPageBtn) prevPageBtn.disabled = this.currentPage === 1;
            if (nextPageBtn) nextPageBtn.disabled = this.currentPage === this.totalPages;
            if (lastPageBtn) lastPageBtn.disabled = this.currentPage === this.totalPages;

            this.renderPageNumbers();
        }

        /**
         * 페이지 번호 렌더링
         */
        renderPageNumbers() {
            const { pageNumbersContainer } = this.elements;
            if (!pageNumbersContainer) return;

            pageNumbersContainer.innerHTML = '';

            const maxVisiblePages = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);

            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            // 첫 페이지 표시
            if (startPage > 1) {
                pageNumbersContainer.appendChild(this.createPageButton(1));
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'page-ellipsis';
                    ellipsis.textContent = '...';
                    pageNumbersContainer.appendChild(ellipsis);
                }
            }

            // 중간 페이지들
            for (let i = startPage; i <= endPage; i++) {
                pageNumbersContainer.appendChild(this.createPageButton(i));
            }

            // 마지막 페이지 표시
            if (endPage < this.totalPages) {
                if (endPage < this.totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'page-ellipsis';
                    ellipsis.textContent = '...';
                    pageNumbersContainer.appendChild(ellipsis);
                }
                pageNumbersContainer.appendChild(this.createPageButton(this.totalPages));
            }
        }

        /**
         * 페이지 버튼 생성
         */
        createPageButton(pageNum) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${pageNum === this.currentPage ? 'active' : ''}`;
            btn.textContent = pageNum;
            btn.addEventListener('click', () => this.goToPage(pageNum));
            return btn;
        }

        /**
         * 현재 페이지 반환
         */
        getCurrentPage() {
            return this.currentPage;
        }

        /**
         * 현재 데이터 반환
         */
        getData() {
            return this.data;
        }

        /**
         * 페이지 리셋
         */
        resetPage() {
            this.currentPage = 1;
        }
    }

    // 전역으로 내보내기
    window.PaginationManager = PaginationManager;
})();
