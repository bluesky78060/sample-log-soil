/**
 * 퇴·액비 검정결과 페이지 (SLS-1-205 S2 — 골격 + 데이터 로드 + 렌더)
 *
 * 접수 페이지의 「검정결과」 버튼이 localStorage로 연도·선택 id를 넘기고 이 페이지를 연다.
 *
 * ⚠️ 저장소 계약
 *   검정결과는 window.CompostResultsStore (localStorage `compostTestResults_{year}`)가
 *   단일 진실원이다. AnalysisDB를 쓰지 않는다 — 쓰면 접수 페이지 모달과 갈라진다.
 *
 * ⚠️ 한계 (플랜에 등재)
 *   이 페이지는 storage-manager·firestore-db를 로드하지 않고 localStorage를 직접 읽는다.
 *   접수 페이지가 아직 클라우드에서 내려받지 않은 연도는 **빈 격자**가 된다.
 *   접수 페이지에서 연도를 먼저 로드한 뒤 진입해야 한다.
 *
 * S3 예정: 셀 편집·붙여넣기·방향키 이동·일괄 적용·결과 가져오기
 */
(function () {
    'use strict';

    const RESULT_FIELDS = () => window.CompostFields.RESULT_FIELDS;

    class CompostAnalysisPage {
        constructor() {
            this.year = '';
            this.selectedIds = [];
            this.logs = [];
            this.results = {};
            this.rows = [];
        }

        init() {
            this.cacheElements();
            this.readHandoff();
            this.loadData();
            this.render();
            this.bindEvents();
        }

        cacheElements() {
            this.tableBody = document.getElementById('caTableBody');
            this.emptyState = document.getElementById('emptyState');
            this.recordCount = document.getElementById('recordCount');
            this.yearLabel = document.getElementById('yearLabel');
        }

        /** 접수 페이지가 넘긴 연도·선택 id를 읽는다 */
        readHandoff() {
            const nowYear = String(new Date().getFullYear());
            this.year = localStorage.getItem('compostAnalysis_year') || nowYear;
            try {
                const raw = localStorage.getItem('compostAnalysis_selected_ids');
                const parsed = raw ? JSON.parse(raw) : [];
                this.selectedIds = Array.isArray(parsed) ? parsed.map(String) : [];
            } catch {
                this.selectedIds = [];
            }
            if (this.yearLabel) this.yearLabel.textContent = `${this.year}년`;
        }

        loadData() {
            this.logs = this.loadSampleLogs(this.year);
            this.results = window.CompostResultsStore.load(this.year);
            this.buildRows();
        }

        loadSampleLogs(year) {
            try {
                const raw = localStorage.getItem(`compostSampleLogs_${year}`);
                if (!raw) return [];
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed)) return [];
                // 접수번호 오름차순 (숫자 우선)
                return parsed.sort((a, b) => {
                    const toNum = (s) => {
                        const n = parseFloat(String(s ?? '').replace(/[^\d.]/g, ''));
                        return isNaN(n) ? Infinity : n;
                    };
                    return toNum(a.receptionNumber) - toNum(b.receptionNumber);
                });
            } catch (e) {
                (window.logger?.error || console.error)('퇴·액비 접수 데이터 로드 실패:', e);
                return [];
            }
        }

        /**
         * 격자 행 구성.
         * 선택 id가 비어 있으면 **그 연도 전건**을 대상으로 한다 —
         * 접수 목록에서 아무것도 체크하지 않고 버튼을 누른 경우다.
         */
        buildRows() {
            const wanted = this.selectedIds.length > 0 ? new Set(this.selectedIds) : null;
            this.rows = this.logs
                .filter(log => !wanted || wanted.has(String(log.id)))
                .map(log => ({
                    key: String(log.id),
                    log,
                    // importer가 getFlatRows()에 .filter(r => !r.isSubLot)를 건다.
                    // 퇴비에 하위필지 개념이 없으므로 항상 false다.
                    isSubLot: false
                }));
        }

        applies(field, log) {
            return window.CompostFields.appliesTo(
                field, log.sampleType || '가축분퇴비', log.animalType || ''
            );
        }

        render() {
            if (!this.tableBody) return;

            if (this.rows.length === 0) {
                this.tableBody.innerHTML = '';
                if (this.emptyState) this.emptyState.style.display = 'flex';
                if (this.recordCount) this.recordCount.textContent = '0건';
                return;
            }
            if (this.emptyState) this.emptyState.style.display = 'none';
            if (this.recordCount) this.recordCount.textContent = `${this.rows.length}건`;

            const frag = document.createDocumentFragment();
            this.rows.forEach((row, ri) => frag.appendChild(this.createRow(row, ri)));
            this.tableBody.innerHTML = '';
            this.tableBody.appendChild(frag);
        }

        createRow(row, rowIdx) {
            const tr = document.createElement('tr');
            tr.setAttribute('data-log-id', row.key);

            // --- 고정 정보 ---
            const tdCheck = document.createElement('td');
            tdCheck.className = 'col-checkbox sticky-col';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'row-checkbox';
            cb.dataset.id = row.key;
            tdCheck.appendChild(cb);
            tr.appendChild(tdCheck);

            const fixed = [
                ['col-reception sticky-col', row.log.receptionNumber],
                ['col-farm', row.log.farmName],
                ['col-sampletype', row.log.sampleType],
                ['col-animal', row.log.animalType],
            ];
            for (const [cls, val] of fixed) {
                const td = document.createElement('td');
                td.className = cls;
                td.textContent = val || '';
                tr.appendChild(td);
            }

            // --- 검정 결과 8열 ---
            const result = this.results[row.key] || {};
            RESULT_FIELDS().forEach((field, colIdx) => {
                const td = document.createElement('td');
                td.className = 'col-result';
                td.dataset.row = String(rowIdx);
                td.dataset.col = String(colIdx);
                td.dataset.field = field;

                if (this.applies(field, row.log)) {
                    td.classList.add('editable-cell');
                    td.textContent = result[field] ?? '';
                } else {
                    // 해당 없음 — 값을 담지도, 받지도 않는다.
                    // S3의 붙여넣기·가져오기·일괄적용이 이 표시를 근거로 건너뛴다.
                    td.classList.add('cell-na');
                    td.title = '이 시료종류·축종에는 해당하지 않는 항목입니다';
                    td.textContent = '';
                }
                tr.appendChild(td);
            });

            return tr;
        }

        bindEvents() {
            document.getElementById('backBtn')?.addEventListener('click', () => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = '../compost/index.html';
            });

            document.getElementById('selectAll')?.addEventListener('change', (e) => {
                document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = e.target.checked; });
            });
        }
    }

    window.CompostAnalysisPage = CompostAnalysisPage;

    document.addEventListener('DOMContentLoaded', () => {
        const page = new CompostAnalysisPage();
        page.init();
        window.compostAnalysisPage = page;
    });
})();
