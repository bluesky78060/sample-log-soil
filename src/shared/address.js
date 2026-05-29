// ========================================
// 공통 주소 검색 모듈
// 행정안전부 도로명주소 검색 API(juso) 기반 자체 모달 UI
// SAMPL-1-47: Kakao(Daum) Postcode CDN 의존 제거
// ========================================

/**
 * 주소 검색 관리자 클래스 (juso API)
 *
 * 입력 단어로 juso API를 호출해 도로명/지번 주소를 검색하고,
 * 선택 시 우편번호/도로명 주소 필드를 채운 뒤 모달을 닫는다.
 */
class AddressManager {
    /**
     * @param {Object} options - 옵션
     * @param {HTMLElement|null} options.searchBtn - 검색 버튼
     * @param {HTMLInputElement|null} options.postcodeInput - 우편번호 입력 필드
     * @param {HTMLInputElement|null} options.roadInput - 도로명 주소 입력 필드
     * @param {HTMLInputElement|null} options.detailInput - 상세 주소 입력 필드
     * @param {HTMLInputElement|null} options.hiddenInput - 전체 주소 히든 필드
     * @param {HTMLElement|null} options.modal - 모달 요소
     * @param {HTMLElement|null} options.closeBtn - 닫기 버튼
     * @param {HTMLElement|null} options.container - 검색 UI 렌더링 컨테이너
     */
    constructor(options) {
        this.searchBtn = options.searchBtn;
        this.postcodeInput = options.postcodeInput;
        this.roadInput = options.roadInput;
        this.detailInput = options.detailInput;
        this.hiddenInput = options.hiddenInput;
        this.modal = options.modal;
        this.closeBtn = options.closeBtn;
        this.container = options.container;

        this._page = 1;
        this._pageSize = 10;
        this._lastKeyword = '';
        this._total = 0;
        this._items = [];
        this._searching = false;
        this._uiReady = false;

        this.init();
    }

    /**
     * 초기화 - 모달 이벤트 + 버튼 위임
     */
    init() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.modal) {
            const overlay = this.modal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => this.closeModal());
            }
        }
        if (this.searchBtn) {
            this.searchBtn.addEventListener('click', () => this.openSearch());
        }
        if (!this._delegateBound) {
            this._delegateBound = true;
            const expectedBtn = this.searchBtn;
            const expectedId = (expectedBtn && expectedBtn.id) || 'searchAddressBtn';
            document.addEventListener('click', (e) => {
                const t = e.target && e.target.closest ? e.target.closest('#' + expectedId) : null;
                if (!t) return;
                if (this.modal && !this.modal.classList.contains('hidden')) return;
                this.openSearch();
            });
        }
        if (this.detailInput) {
            this.detailInput.addEventListener('input', () => this.updateFullAddress());
        }
    }

    /**
     * 주소 검색 모달 열기
     * - 자체 UI를 container 내부에 렌더링
     */
    openSearch() {
        if (!this.container) {
            alert('주소 검색 컨테이너가 존재하지 않습니다.');
            return;
        }
        if (!window.JusoService || !window.electronAPI?.jusoSearch) {
            alert('juso 주소 검색은 데스크톱(Electron) 환경에서만 사용 가능합니다.');
            return;
        }

        if (this.modal) {
            this.modal.classList.remove('hidden');
        }

        this._renderSearchUI();
        // 자동 포커스 (모달 트랜지션 고려)
        setTimeout(() => {
            const input = this.container.querySelector('.juso-search-input');
            if (input) input.focus();
        }, 50);
    }

    /**
     * 검색 UI 컨테이너 내부 마크업 + 이벤트 바인딩
     */
    _renderSearchUI() {
        // SAMPL-1-47 M-4: 중복 렌더 방지 (delegation + direct binding 동시 트리거 케이스)
        if (this._uiReady && this.container.querySelector('.juso-search-input')) return;
        const safeId = 'juso-' + Math.random().toString(36).slice(2, 8);
        this.container.innerHTML = `
            <div class="juso-search-wrap" data-id="${safeId}">
                <div class="juso-search-row">
                    <input type="text" class="juso-search-input"
                        placeholder="도로명/지번/건물명 검색"
                        autocomplete="off" maxlength="80">
                    <button type="button" class="juso-search-btn">검색</button>
                </div>
                <div class="juso-search-hint">예: <em>○○로 12</em>, <em>○○읍 ○○리</em>, <em>○○초등학교</em></div>
                <div class="juso-search-status" aria-live="polite"></div>
                <ul class="juso-search-results"></ul>
                <div class="juso-search-pager">
                    <button type="button" class="juso-page-prev" disabled>← 이전</button>
                    <span class="juso-page-info">0 건</span>
                    <button type="button" class="juso-page-next" disabled>다음 →</button>
                </div>
            </div>
        `;

        const input = this.container.querySelector('.juso-search-input');
        const btn = this.container.querySelector('.juso-search-btn');
        const results = this.container.querySelector('.juso-search-results');
        const prevBtn = this.container.querySelector('.juso-page-prev');
        const nextBtn = this.container.querySelector('.juso-page-next');

        const doSearch = (page = 1) => {
            const keyword = (input.value || '').trim();
            if (!keyword) return;
            this._lastKeyword = keyword;
            this._page = page;
            this._runSearch();
        };

        btn.addEventListener('click', () => doSearch(1));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doSearch(1);
            }
        });
        prevBtn.addEventListener('click', () => {
            if (this._page > 1) doSearch(this._page - 1);
        });
        nextBtn.addEventListener('click', () => {
            const maxPage = Math.max(1, Math.ceil(this._total / this._pageSize));
            if (this._page < maxPage) doSearch(this._page + 1);
        });

        results.addEventListener('click', (e) => {
            const li = e.target.closest('li[data-idx]');
            if (!li) return;
            const idx = Number(li.dataset.idx);
            const item = this._items[idx];
            if (item) this._onJusoSelected(item);
        });
        // 키보드 ↑↓ Enter 지원
        results.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const active = document.activeElement;
            if (active && active.dataset && active.dataset.idx !== undefined) {
                e.preventDefault();
                const idx = Number(active.dataset.idx);
                const item = this._items[idx];
                if (item) this._onJusoSelected(item);
            }
        });

        this._uiReady = true;
    }

    /**
     * 실제 검색 실행 (JusoService 호출 + 렌더링)
     */
    async _runSearch() {
        if (this._searching) return;
        const statusEl = this.container.querySelector('.juso-search-status');
        const resultsEl = this.container.querySelector('.juso-search-results');
        const prevBtn = this.container.querySelector('.juso-page-prev');
        const nextBtn = this.container.querySelector('.juso-page-next');
        const infoEl = this.container.querySelector('.juso-page-info');
        // SAMPL-1-47 M-6: 검색 중 버튼 비활성화 (입력 무시 시각화)
        const searchBtn = this.container.querySelector('.juso-search-btn');

        this._searching = true;
        if (searchBtn) searchBtn.disabled = true;
        statusEl.textContent = '검색 중...';
        resultsEl.innerHTML = '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        try {
            const r = await window.JusoService.search(this._lastKeyword, {
                page: this._page,
                size: this._pageSize
            });
            if (!r.ok) {
                statusEl.textContent = `오류: ${r.error || '검색 실패'}`;
                infoEl.textContent = '0 건';
                this._items = [];
                this._total = 0;
                return;
            }
            this._items = r.items || [];
            this._total = Number(r.total) || 0;
            if (this._items.length === 0) {
                statusEl.textContent = '검색 결과가 없습니다.';
                infoEl.textContent = '0 건';
                return;
            }
            statusEl.textContent = '';
            this._renderResults(resultsEl);
            const maxPage = Math.max(1, Math.ceil(this._total / this._pageSize));
            infoEl.textContent = `${this._total.toLocaleString()} 건 (${this._page}/${maxPage})`;
            prevBtn.disabled = this._page <= 1;
            nextBtn.disabled = this._page >= maxPage;
        } catch (err) {
            statusEl.textContent = `오류: ${err?.message || '알 수 없는 오류'}`;
        } finally {
            this._searching = false;
            if (searchBtn) searchBtn.disabled = false;
        }
    }

    /**
     * 결과 리스트 렌더링
     * @param {HTMLElement} ul
     */
    _renderResults(ul) {
        const esc = (window.sanitize?.escapeHTML)
            || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
            }[c])));
        const html = this._items.map((it, idx) => {
            const road = esc(it.roadAddr || it.roadAddrPart1 || '');
            const jibun = esc(it.jibunAddr || '');
            const zip = esc(it.zipNo || '');
            const bdNm = esc(it.bdNm || '');
            return `
                <li data-idx="${idx}" tabindex="0">
                    <div class="juso-item-road">
                        <span class="juso-zip">[${zip}]</span>
                        <strong>${road}</strong>
                        ${bdNm ? `<span class="juso-bdnm">(${bdNm})</span>` : ''}
                    </div>
                    <div class="juso-item-jibun">지번: ${jibun}</div>
                </li>
            `;
        }).join('');
        ul.innerHTML = html;
    }

    /**
     * 결과 선택 핸들러: juso 형식을 Kakao 형식으로 매핑 후 기존 onAddressSelected로 위임
     * @param {Object} juso - juso API 응답 항목 1건
     */
    _onJusoSelected(juso) {
        // Kakao Postcode 응답 호환 형태로 매핑
        // SAMPL-1-47 M-3: juso.bdKdcd === '1' → 공동주택 (Y) 매핑 (apartment 회귀 방지)
        const isApartment = String(juso.bdKdcd || '') === '1';
        const adapted = {
            zonecode: juso.zipNo || '',
            roadAddress: juso.roadAddr || juso.roadAddrPart1 || '',
            jibunAddress: juso.jibunAddr || '',
            bname: juso.liNm || juso.emdNm || '',
            buildingName: juso.bdNm || '',
            apartment: isApartment ? 'Y' : 'N',
            sido: juso.siNm || '',
            sigungu: juso.sggNm || ''
        };
        this.onAddressSelected(adapted);
    }

    /**
     * 주소 선택 완료 핸들러 (Kakao 응답 형식 어댑터를 받음)
     * @param {Object} data
     */
    onAddressSelected(data) {
        const roadAddr = data.roadAddress || '';
        let extraRoadAddr = '';

        // SAMPL-1-47 M-5: 문자 클래스 내 |는 리터럴 파이프로 잘못 매칭 → 정정 + /g 제거 (test() lastIndex 부작용 방지)
        if (data.bname && /[동로가]$/.test(data.bname)) {
            extraRoadAddr += data.bname;
        }
        if (data.buildingName && data.apartment === 'Y') {
            extraRoadAddr += (extraRoadAddr !== '' ? ', ' + data.buildingName : data.buildingName);
        }
        if (extraRoadAddr !== '') {
            extraRoadAddr = ' (' + extraRoadAddr + ')';
        }

        if (this.postcodeInput) this.postcodeInput.value = data.zonecode || '';
        if (this.roadInput) this.roadInput.value = roadAddr + extraRoadAddr;

        if (this.detailInput) {
            this.detailInput.focus();
        }

        this.updateFullAddress();
        this.closeModal();
    }

    /**
     * 모달 닫기
     */
    closeModal() {
        if (this.modal) {
            this.modal.classList.add('hidden');
        }
        setTimeout(() => {
            if (this.container) {
                this.container.innerHTML = '';
            }
            this._uiReady = false;
            this._items = [];
            this._page = 1;
            this._total = 0;
            this._lastKeyword = '';
        }, 100);
    }

    /**
     * 전체 주소 업데이트
     */
    updateFullAddress() {
        if (!this.hiddenInput) return;
        const postcode = this.postcodeInput?.value || '';
        const road = this.roadInput?.value || '';
        const detail = this.detailInput?.value || '';
        if (postcode && road) {
            this.hiddenInput.value = `(${postcode}) ${road}${detail ? ' ' + detail : ''}`;
        } else {
            this.hiddenInput.value = '';
        }
    }

    /**
     * 주소 필드 초기화
     */
    clear() {
        if (this.postcodeInput) this.postcodeInput.value = '';
        if (this.roadInput) this.roadInput.value = '';
        if (this.detailInput) this.detailInput.value = '';
        if (this.hiddenInput) this.hiddenInput.value = '';
    }

    /**
     * 주소 값 설정
     * @param {string} postcode
     * @param {string} road
     * @param {string} detail
     */
    setValue(postcode, road, detail) {
        if (this.postcodeInput) this.postcodeInput.value = postcode || '';
        if (this.roadInput) this.roadInput.value = road || '';
        if (this.detailInput) this.detailInput.value = detail || '';
        this.updateFullAddress();
    }
}

// juso 자체 모달 스타일 (외부 CSS 의존성 제거 위해 일회성 주입)
(function injectJusoStyle() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('juso-search-style')) return;
    const style = document.createElement('style');
    style.id = 'juso-search-style';
    style.textContent = `
        .juso-search-wrap { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
        .juso-search-row { display: flex; gap: 6px; }
        .juso-search-input { flex: 1; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; outline: none; }
        .juso-search-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        .juso-search-btn { padding: 8px 14px; background: #2563eb; color: #fff; border: 0; border-radius: 6px; cursor: pointer; font-weight: 500; }
        .juso-search-btn:hover { background: #1d4ed8; }
        .juso-search-hint { font-size: 12px; color: #6b7280; }
        .juso-search-hint em { font-style: normal; color: #2563eb; }
        .juso-search-status { min-height: 18px; font-size: 12px; color: #6b7280; }
        .juso-search-results { list-style: none; padding: 0; margin: 0; max-height: 360px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
        .juso-search-results:empty { border: 0; }
        .juso-search-results li { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; outline: none; }
        .juso-search-results li:last-child { border-bottom: 0; }
        .juso-search-results li:hover, .juso-search-results li:focus { background: #eff6ff; }
        .juso-item-road { font-size: 14px; color: #111827; }
        .juso-item-road strong { font-weight: 600; }
        .juso-zip { display: inline-block; min-width: 50px; color: #2563eb; font-size: 12px; margin-right: 4px; }
        .juso-bdnm { color: #6b7280; font-size: 12px; margin-left: 4px; }
        .juso-item-jibun { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .juso-search-pager { display: flex; justify-content: space-between; align-items: center; padding-top: 4px; font-size: 13px; }
        .juso-search-pager button { padding: 4px 10px; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; }
        .juso-search-pager button:disabled { opacity: 0.4; cursor: not-allowed; }
        .juso-page-info { color: #6b7280; }
        /* 다크 모드 */
        [data-theme="dark"] .juso-search-input { background: #1f2937; color: #f9fafb; border-color: #374151; }
        [data-theme="dark"] .juso-search-input:focus { border-color: #60a5fa; }
        [data-theme="dark"] .juso-search-hint, [data-theme="dark"] .juso-search-status, [data-theme="dark"] .juso-page-info, [data-theme="dark"] .juso-item-jibun, [data-theme="dark"] .juso-bdnm { color: #9ca3af; }
        [data-theme="dark"] .juso-search-results { border-color: #374151; }
        [data-theme="dark"] .juso-search-results li { border-color: #1f2937; color: #e5e7eb; }
        [data-theme="dark"] .juso-search-results li:hover, [data-theme="dark"] .juso-search-results li:focus { background: #1e3a8a; }
        [data-theme="dark"] .juso-item-road { color: #f9fafb; }
        [data-theme="dark"] .juso-search-pager button { background: #1f2937; border-color: #374151; color: #e5e7eb; }
        [data-theme="dark"] .juso-zip { color: #60a5fa; }
    `;
    document.head.appendChild(style);
})();

window.AddressManager = AddressManager;
