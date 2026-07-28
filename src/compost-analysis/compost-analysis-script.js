/**
 * 퇴·액비 검정결과 페이지 (SLS-1-205 S2~S3)
 *
 * 접수 페이지의 「검정결과」 버튼이 localStorage로 연도·선택 id를 넘기고 이 페이지를 연다.
 *
 * ⚠️ 저장소 계약
 *   검정결과는 window.CompostResultsStore (localStorage `compostTestResults_{year}`)가
 *   단일 진실원이다. AnalysisDB를 쓰지 않는다 — 쓰면 접수 페이지 모달과 갈라진다.
 *
 * ⚠️ 접수 대장 역기록 (S3)
 *   접수 목록은 log.moisture / log.maturity를 직접 렌더한다. 검정결과 저장소에만
 *   쓰면 격자에서 100건을 입력해도 접수 대장 열이 비어 있다. 두 곳에 함께 쓴다.
 *   단 **log.testResult(판정)는 건드리지 않는다** — 격자에 판정 열이 없으므로
 *   덮어쓰면 모달·목록에서 내린 판정이 지워진다.
 *
 * ⚠️ 한계
 *   이 페이지는 storage-manager·firestore-db를 로드하지 않고 localStorage를 직접 읽는다.
 *   접수 페이지가 아직 클라우드에서 내려받지 않은 연도는 **빈 격자**가 된다.
 */
(function () {
    'use strict';

    const RESULT_FIELDS = () => window.CompostFields.RESULT_FIELDS;

    /**
     * 입력 상식 범위 — **법정 기준이 아니다.**
     * 오타(62.1을 621로 침) 같은 명백한 실수를 짚기 위한 상한/하한이며,
     * 적합·부적합 판정과는 무관하다. 판정은 검사자가 직접 한다(SLS-1-202).
     */
    const FIELD_RANGES = {
        moisture: { min: 0, max: 100 },
        copper: { min: 0, max: 10000 },
        zinc: { min: 0, max: 20000 },
        salinity: { min: 0, max: 20 },
        nitrogen: { min: 0, max: 100 },
        phosphorus: { min: 0, max: 100 },
        potassium: { min: 0, max: 100 },
    };

    const MAX_CELL_LEN = window.SampleConstants?.VALIDATION?.MAX_CELL_INPUT_LENGTH ?? 200;

    class CompostAnalysisPage {
        constructor() {
            this.year = '';
            this.selectedIds = [];
            this.logs = [];
            this.results = {};
            this.rows = [];
            this.focusedCell = null;
        }

        init() {
            this.cacheElements();
            this.readHandoff();
            this.loadData();
            this.render();
            this.bindEvents();
            this.setupResultImporter();
        }

        // ===== 결과 가져오기 (S4) =====

        /**
         * HeuktoramResultImporter 재사용. 토양과 같은 클래스를 쓴다.
         *
         * 🚨 applyResult에 **비해당 필터**를 건다. 붙여넣기와 같은 계약이다 —
         *    없으면 가져오기 경로로 돼지 행에 염분이 들어간다.
         */
        setupResultImporter() {
            if (!window.HeuktoramResultImporter) return;

            const F = window.CompostFields;
            this.resultImporter = new window.HeuktoramResultImporter({
                resultFields: F.RESULT_FIELDS,
                fieldLabels: {
                    moisture: '함수율', maturity: '부숙도',
                    copper: '구리(Cu)', zinc: '아연(Zn)', salinity: '염분',
                    nitrogen: '질소(N)', phosphorus: '인산(P₂O₅)', potassium: '칼리(K₂O)',
                },
                fieldDecimals: {
                    moisture: 1, maturity: 0,
                    copper: 0, zinc: 0, salinity: 2,
                    nitrogen: 2, phosphorus: 2, potassium: 2,
                },
                fieldRanges: FIELD_RANGES,
                // 기본 맵의 '인산'은 토양 availableP를 가리킨다. cfg가 덮어쓰지 않으면
                // 퇴비의 '인산' 컬럼이 화이트리스트에 걸려 조용히 매핑 실패한다.
                headerAliases: {
                    '함수율': { type: 'field', key: 'moisture' },
                    '수분': { type: 'field', key: 'moisture' },
                    '부숙도': { type: 'field', key: 'maturity' },
                    '구리': { type: 'field', key: 'copper' },
                    'cu': { type: 'field', key: 'copper' },
                    '아연': { type: 'field', key: 'zinc' },
                    'zn': { type: 'field', key: 'zinc' },
                    '염분': { type: 'field', key: 'salinity' },
                    '질소': { type: 'field', key: 'nitrogen' },
                    '인산': { type: 'field', key: 'phosphorus' },
                    '칼리': { type: 'field', key: 'potassium' },
                    '가리': { type: 'field', key: 'potassium' },
                },
                getFlatRows: () => this.rows,
                getTestResults: () => this.results,
                applyResult: (rowKey, field, value) => {
                    const row = this.rows.find(r => r.key === rowKey);
                    // 🚨 비해당 항목은 저장소에 넣지 않는다 (붙여넣기와 동일 계약)
                    if (!row || !this.applies(field, row.log)) return;
                    if (!this.results[rowKey]) this.results[rowKey] = {};
                    this.results[rowKey][field] = value;
                },
                // 퇴비에 하위필지 개념이 없다 — no-op
                syncToSiblings: () => {},
                saveTestResults: () => this.save(),
                rerender: () => this.render(),
            });
            this.resultImporter.init();
        }

        cacheElements() {
            this.tableBody = document.getElementById('caTableBody');
            this.emptyState = document.getElementById('emptyState');
            this.recordCount = document.getElementById('recordCount');
            this.yearLabel = document.getElementById('yearLabel');
            this.bulkTestDate = document.getElementById('bulkTestDate');
        }

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

        /** 선택 id가 비어 있으면 그 연도 전건이 대상이다 */
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

        maturityOptions(log) {
            const f = window.CompostFields
                .getFieldsForSample(log.sampleType || '가축분퇴비', log.animalType || '')
                .find(x => x.key === 'maturity');
            return f?.options || [''];
        }

        // ===== 렌더 =====

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
            this.validateAll();
        }

        createRow(row, rowIdx) {
            const tr = document.createElement('tr');
            tr.setAttribute('data-log-id', row.key);

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

            const result = this.results[row.key] || {};
            RESULT_FIELDS().forEach((field, colIdx) => {
                tr.appendChild(this.createResultCell(row, rowIdx, field, colIdx, result[field]));
            });

            // 최종검토의견 — 양식 AJ열. 축종과 무관하므로 RESULT_FIELDS와 별개로 둔다
            // (RESULT_FIELDS는 appliesTo 필터가 걸리는 검정 항목 전용이다).
            tr.appendChild(this.createOpinionCell(row, result.finalOpinion));

            return tr;
        }

        createResultCell(row, rowIdx, field, colIdx, value) {
            const td = document.createElement('td');
            td.className = 'col-result';
            td.dataset.row = String(rowIdx);
            td.dataset.col = String(colIdx);
            td.dataset.field = field;

            if (!this.applies(field, row.log)) {
                // 해당 없음 — 값을 담지도, 받지도 않는다.
                // 붙여넣기·일괄적용·가져오기가 이 표시를 근거로 건너뛴다.
                td.classList.add('cell-na');
                td.title = '이 시료종류·축종에는 해당하지 않는 항목입니다';
                return td;
            }

            td.classList.add('editable-cell');

            if (field === 'maturity') {
                // 부숙도는 고정 등급이라 select로 둔다 — 잘못된 등급이 아예 안 들어간다.
                const sel = document.createElement('select');
                sel.className = 'cell-select';
                for (const opt of this.maturityOptions(row.log)) {
                    sel.appendChild(new Option(opt || '선택', opt));
                }
                // 목록에 없는 레거시 값도 잃지 않는다
                if (value && !this.maturityOptions(row.log).includes(value)) {
                    sel.appendChild(new Option(value, value, false, true));
                }
                sel.value = value ?? '';
                sel.addEventListener('focus', () => { this.focusedCell = { rowIdx, colIdx }; });
                sel.addEventListener('change', () => this.handleCellEdit(row.key, field, sel.value));
                sel.addEventListener('keydown', (e) => this.onCellKeydown(e, rowIdx, colIdx));
                td.appendChild(sel);
                return td;
            }

            td.contentEditable = 'true';
            td.textContent = value ?? '';
            td.addEventListener('focus', () => {
                this.focusedCell = { rowIdx, colIdx };
                td.classList.add('focused');
            });
            td.addEventListener('blur', () => {
                td.classList.remove('focused');
                this.focusedCell = null;   // MAJOR-1: 해제하지 않으면 모달 입력이 격자로 샌다
                this.handleCellEdit(row.key, field, td.textContent.trim());
            });
            td.addEventListener('keydown', (e) => this.onCellKeydown(e, rowIdx, colIdx, td));
            return td;
        }

        /** 최종검토의견 셀 — 100자 권장(양식 안내문) */
        createOpinionCell(row, value) {
            const td = document.createElement('td');
            td.className = 'col-opinion editable-cell';
            td.dataset.field = 'finalOpinion';
            td.contentEditable = 'true';
            td.textContent = value ?? '';
            td.addEventListener('blur', () => {
                const v = td.textContent.trim().slice(0, 100);
                if (v !== td.textContent.trim()) td.textContent = v;
                this.handleCellEdit(row.key, 'finalOpinion', v);
            });
            return td;
        }

        // ===== 편집 =====

        handleCellEdit(rowKey, field, value) {
            const v = String(value ?? '').slice(0, MAX_CELL_LEN).trim();
            if (!this.results[rowKey]) this.results[rowKey] = {};
            if (this.results[rowKey][field] === v) return;
            this.results[rowKey][field] = v;
            this.validateCellByKey(rowKey, field);
            this.save();
        }

        // ===== 범위 검증 (상식 범위 — 법정 기준 아님) =====

        validateCellByKey(rowKey, field) {
            const rowIdx = this.rows.findIndex(r => r.key === rowKey);
            if (rowIdx < 0) return;
            const colIdx = RESULT_FIELDS().indexOf(field);
            // finalOpinion은 검정 항목이 아니라 RESULT_FIELDS에 없다(-1) — 범위 검증 대상도 아니다
            if (colIdx < 0) return;
            const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
            if (cell) this.markRange(cell, field, this.results[rowKey]?.[field]);
        }

        markRange(cell, field, value) {
            const r = FIELD_RANGES[field];
            cell.classList.remove('out-of-range');
            // 코드리뷰 MINOR-2: title도 지운다. 안 지우면 621 → 62.1로 고쳐도
            // "범위를 벗어났습니다" 툴팁이 남아 정정한 값을 계속 오타라고 주장한다.
            cell.removeAttribute('title');
            if (!r || value === '' || value == null) return;
            const num = parseFloat(String(value).replace(/,/g, ''));
            if (isNaN(num)) return;
            if (num < r.min || num > r.max) {
                cell.classList.add('out-of-range');
                cell.title = `입력 상식 범위(${r.min}~${r.max})를 벗어났습니다. 오타가 아닌지 확인해 주세요. (적합·부적합 판정과는 무관합니다)`;
            }
        }

        validateAll() {
            this.rows.forEach((row, rowIdx) => {
                RESULT_FIELDS().forEach((field, colIdx) => {
                    const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
                    if (cell && cell.classList.contains('editable-cell')) {
                        this.markRange(cell, field, this.results[row.key]?.[field]);
                    }
                });
            });
        }

        // ===== 포커스 이동 =====

        /** 편집 가능한 셀만 찾는다 — 비해당 셀은 건너뛴다 */
        focusableAt(rowIdx, colIdx) {
            const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
            if (!cell || !cell.classList.contains('editable-cell')) return null;
            return cell.querySelector('select') || cell;
        }

        moveFocus(rowIdx, colIdx, dRow, dCol) {
            const maxRow = this.rows.length - 1;
            const maxCol = RESULT_FIELDS().length - 1;
            let r = rowIdx, c = colIdx;
            for (let guard = 0; guard <= (maxRow + 1) * (maxCol + 1); guard++) {
                r += dRow; c += dCol;
                if (dCol > 0 && c > maxCol) { c = 0; r += 1; }
                if (dCol < 0 && c < 0) { c = maxCol; r -= 1; }
                if (r < 0 || r > maxRow) return;
                const el = this.focusableAt(r, c);
                if (el) { el.focus(); return; }
            }
        }

        onCellKeydown(e, rowIdx, colIdx, td) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                td?.blur();
                this.moveFocus(rowIdx, colIdx, 1, 0);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                td?.blur();
                this.moveFocus(rowIdx, colIdx, 0, e.shiftKey ? -1 : 1);
            } else if (e.key === 'ArrowDown' && !td) {
                // select는 위/아래로 옵션을 바꾸므로 셀 이동에 쓰지 않는다
            }
        }

        // ===== 붙여넣기 =====

        /**
         * 엑셀 범위 붙여넣기.
         *
         * 🚨 비해당 셀은 건너뛴다. 이 가드가 없으면 8열 블록을 붙여넣을 때
         *    돼지 행에 염분이 기록된다 — 화면엔 비활성이라 안 보이는데 저장소엔
         *    들어가고 그대로 흙토람으로 전송된다.
         */
        handlePaste(event) {
            if (!this.focusedCell) return;

            // 코드리뷰 MAJOR-1: 격자 셀에 포커스가 있을 때만 가로챈다.
            //   focusedCell은 blur에서 해제되므로 대부분 충분하지만, document 레벨
            //   핸들러라 결과 가져오기 모달의 #importerTextarea나 도구바 입력에
            //   붙여넣을 때도 발동할 수 있다. 그러면 preventDefault로 그쪽 입력이
            //   죽고 클립보드가 엉뚱한 셀에 써진다. (토양 원본에 있는 가드다)
            const activeEl = document.activeElement;
            if (!activeEl || !activeEl.closest?.('.editable-cell')) return;

            const text = (event.clipboardData || window.clipboardData)?.getData('text/plain');
            if (!text) return;
            event.preventDefault();

            const lines = text.split(/\r?\n/).filter(l => l.length > 0);
            const startRow = this.focusedCell.rowIdx;
            const startCol = this.focusedCell.colIdx;
            const fields = RESULT_FIELDS();

            let applied = 0, skipped = 0;

            for (let ri = 0; ri < lines.length; ri++) {
                const targetRow = startRow + ri;
                if (targetRow >= this.rows.length) break;
                const row = this.rows[targetRow];
                const cols = lines[ri].split('\t');

                for (let ci = 0; ci < cols.length; ci++) {
                    const targetCol = startCol + ci;
                    if (targetCol >= fields.length) break;
                    const field = fields[targetCol];

                    if (!this.applies(field, row.log)) { skipped++; continue; }

                    const value = cols[ci].trim().slice(0, MAX_CELL_LEN);
                    if (!this.results[row.key]) this.results[row.key] = {};
                    this.results[row.key][field] = value;
                    this.paintCell(targetRow, targetCol, field, value, row.log);
                    applied++;
                }
            }

            if (applied > 0) this.save();

            if (skipped > 0) {
                window.showToast?.(
                    `${applied}개 셀에 붙여넣었습니다. 해당 없는 항목 ${skipped}칸은 건너뛰었습니다.`,
                    'warning'
                );
            } else if (applied > 0) {
                window.showToast?.(`${applied}개 셀에 붙여넣었습니다.`, 'success');
            }
        }

        paintCell(rowIdx, colIdx, field, value, log) {
            const cell = this.tableBody?.querySelector(`td[data-row="${rowIdx}"][data-col="${colIdx}"]`);
            if (!cell) return;
            const sel = cell.querySelector('select');
            if (sel) {
                if (value && !Array.from(sel.options).some(o => o.value === value)) {
                    // 목록에 없는 값도 잃지 않는다 (레거시·타 기기)
                    sel.appendChild(new Option(value, value));
                }
                sel.value = value;
            } else {
                cell.textContent = value;
            }
            this.markRange(cell, field, value);
            cell.classList.add('paste-highlight');
            setTimeout(() => cell.classList.remove('paste-highlight'), 1500);
            if (log) { /* 시그니처 유지 */ }
        }

        // ===== 일괄 적용 =====

        selectedRowKeys() {
            return Array.from(document.querySelectorAll('.row-checkbox:checked'))
                .map(cb => cb.dataset.id)
                .filter(Boolean);
        }

        /** 검사일자 일괄 적용. 비해당 개념이 없는 메타 필드라 필터가 필요 없다. */
        applyBulkTestDate(value) {
            const keys = this.selectedRowKeys();
            if (keys.length === 0) {
                window.showToast?.('적용할 행을 먼저 선택해 주세요.', 'warning');
                return;
            }
            keys.forEach(k => {
                if (!this.results[k]) this.results[k] = {};
                this.results[k].testDate = value;
            });
            this.save();
            window.showToast?.(
                value ? `${keys.length}건에 검사일자를 적용했습니다.` : `${keys.length}건의 검사일자를 지웠습니다.`,
                'success'
            );
        }

        // ===== 저장 =====

        /**
         * 검정결과 저장소 + 접수 대장 역기록.
         *
         * 접수 목록은 log.moisture / log.maturity를 직접 렌더한다. 저장소에만 쓰면
         * 격자 입력이 접수 대장에 안 보인다.
         * ⚠️ log.testResult(판정)는 건드리지 않는다 — 격자에 판정 열이 없으므로
         *    덮어쓰면 모달·목록에서 내린 판정이 지워진다.
         */
        save() {
            const okResults = window.CompostResultsStore.save(this.year, this.results);
            const okLogs = this.writeBackToLogs();

            if (!okResults && !okLogs) {
                window.showToast?.('저장 공간이 부족해 저장하지 못했습니다. 설정에서 오래된 연도의 자료를 정리해 주세요.', 'error');
            } else if (!okResults) {
                window.showToast?.('저장 공간이 부족해 검정결과가 저장되지 않았습니다.', 'error');
            } else if (!okLogs) {
                window.showToast?.('검정결과는 저장됐으나 접수 대장 반영에 실패했습니다.', 'error');
            }
            return okResults && okLogs;
        }

        /**
         * ⚠️ 저장 직전에 **다시 읽는다** (read-modify-write).
         *
         * 코드리뷰 CRITICAL-1: init 시점 스냅샷(this.logs)을 통째로 직렬화하면
         * 다른 창의 변경이 조용히 소실된다. 이 페이지는 별도 창이고 접수 페이지와
         * localStorage를 공유하므로, 팝업을 띄워둔 채 접수 페이지에서 등록·수정·삭제한 뒤
         * 격자에서 셀 하나만 입력해도 그 변경이 전부 되돌아간다(삭제한 건은 부활).
         * Electron에서 팝업은 싱글턴으로 계속 떠 있어 일상 동선이다.
         *
         * 그래서 스냅샷을 쓰지 않고, 최신본을 읽어 **편집한 필드만 패치**한다.
         */
        writeBackToLogs() {
            let fresh;
            try {
                fresh = JSON.parse(localStorage.getItem(`compostSampleLogs_${this.year}`) || '[]');
            } catch (e) {
                (window.logger?.error || console.error)('접수 대장 재읽기 실패:', e);
                return false;
            }
            if (!Array.isArray(fresh)) return false;

            let changed = false;
            for (const row of this.rows) {
                const r = this.results[row.key];
                if (!r) continue;
                // 다른 창에서 삭제됐으면 되살리지 않는다 — 없으면 건너뛴다
                const src = fresh.find(l => String(l.id) === row.key);
                if (!src) continue;
                if (r.moisture !== undefined && src.moisture !== r.moisture) {
                    src.moisture = r.moisture; changed = true;
                }
                if (r.maturity !== undefined && src.maturity !== r.maturity) {
                    src.maturity = r.maturity; changed = true;
                }
            }
            if (!changed) {
                this.logs = fresh;   // 변경이 없어도 최신본으로 맞춰 둔다
                return true;
            }
            try {
                localStorage.setItem(`compostSampleLogs_${this.year}`, JSON.stringify(fresh));
                this.logs = fresh;
                return true;
            } catch (e) {
                (window.logger?.error || console.error)('접수 대장 역기록 실패:', e);
                return false;
            }
        }

        // ===== 흙토람 내보내기 (SLS-1-200) =====

        async exportToHeuktoram() {
            const E = window.CompostHeuktoramExport;
            if (!E) { window.showToast?.('내보내기 모듈을 불러오지 못했습니다.', 'error'); return; }
            if (this.rows.length === 0) {
                window.showToast?.('내보낼 자료가 없습니다.', 'warning');
                return;
            }
            // 양식 안내문의 권장 상한. 막지 않고 알린다 — 나눠 넣을지는 사용자가 정한다.
            if (this.rows.length > E.RECOMMENDED_MAX) {
                window.showToast?.(
                    `${this.rows.length}건입니다. 흙토람은 1회 ${E.RECOMMENDED_MAX}건 이하를 권장합니다 — 나눠서 올리시면 안정적입니다.`,
                    'warning'
                );
            }
            // 코드리뷰 MAJOR-2: 양식 안내문상 **가축분퇴비는 면적 필수**다.
            //   공란으로 300건을 올린 뒤 거부당하면 어느 행인지 찾는 비용이 크다.
            //   막지는 않고(액비는 면적 불필요) 접수번호를 짚어 알린다.
            const F = window.CompostFields;
            const missingArea = this.rows.filter(r =>
                (r.log.sampleType || '가축분퇴비') === '가축분퇴비' &&
                F.getAreaInSqm(r.log.farmArea, r.log.farmAreaUnit) <= 0
            );
            if (missingArea.length > 0) {
                const nums = missingArea.slice(0, 5).map(r => r.log.receptionNumber).join(', ');
                const more = missingArea.length > 5 ? ` 외 ${missingArea.length - 5}건` : '';
                window.showToast?.(
                    `면적이 비어 있는 가축분퇴비 ${missingArea.length}건이 있습니다 (접수번호 ${nums}${more}). 흙토람은 퇴비의 면적을 필수로 요구합니다.`,
                    'warning'
                );
            }

            try {
                const today = new Date().toISOString().slice(0, 10);
                // exportFile이 Q·W열 드롭다운까지 주입한다 (JSZip 필요)
                await E.exportFile(this.rows, this.results,
                    `흙토람_성분검사결과_${this.year}_${today}.xlsx`);
                window.showToast?.(`${this.rows.length}건을 내보냈습니다.`, 'success');
            } catch (e) {
                (window.logger?.error || console.error)('흙토람 내보내기 실패:', e);
                window.showToast?.('내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.', 'error');
            }
        }

        // ===== 이벤트 =====

        bindEvents() {
            document.getElementById('backBtn')?.addEventListener('click', () => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = '../compost/index.html';
            });

            document.getElementById('selectAll')?.addEventListener('change', (e) => {
                document.querySelectorAll('.row-checkbox').forEach(cb => { cb.checked = e.target.checked; });
            });

            document.addEventListener('paste', (e) => this.handlePaste(e));

            document.getElementById('applyBulkBtn')?.addEventListener('click', () => {
                this.applyBulkTestDate(this.bulkTestDate?.value || '');
            });
            document.getElementById('exportHeuktoramBtn')?.addEventListener('click', () => {
                this.exportToHeuktoram();
            });
            document.getElementById('clearTestDateBtn')?.addEventListener('click', () => {
                if (this.bulkTestDate) this.bulkTestDate.value = '';
                this.applyBulkTestDate('');
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
