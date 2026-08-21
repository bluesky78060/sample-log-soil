/**
 * ExcelImportManager - 엑셀 가져오기 공통 모듈
 *
 * 모든 시료 타입(토양, 수질, 퇴액비, 중금속, 잔류농약)의
 * 엑셀 가져오기 3단계 위자드를 공통화합니다.
 *
 * 사용법:
 *   const importer = new ExcelImportManager({ ...config });
 *   importer.init();
 *
 * @global window.ExcelImportManager
 */
class ExcelImportManager {
    /**
     * @param {Object} config
     * @param {Array<{key:string, label:string}>} config.appFields - 앱 필드 정의
     * @param {Object<string, string>} config.autoMapRules - 자동매핑 규칙 (엑셀헤더 → 앱필드키)
     * @param {Object} config.templateConfig - 서식 다운로드 설정
     * @param {string[]} config.templateConfig.headers - 서식 헤더
     * @param {Array} config.templateConfig.sampleRow - 예시 행
     * @param {Array<{wch:number}>} config.templateConfig.colWidths - 컬럼 너비
     * @param {string} config.templateConfig.sheetName - 시트명
     * @param {string} config.templateConfig.fileName - 파일명 (확장자 제외)
     * @param {Array<{key:string, label:string}>} config.previewColumns - 미리보기 테이블 컬럼
     * @param {Function} config.buildRecord - (getVal, parseExcelDate, commonData, rowIdx) => object
     * @param {Function} [config.skipRowCheck] - (record, rowIdx, raw) => string|null (경고 또는 null)
     *        ⚠️ `record`는 buildRecord가 기본값·공통값을 채운 뒤다. "비었는지"를 볼 때는
     *           세 번째 인자 `raw(field)`(그 행의 원본 셀)를 쓸 것 (SLS-1-273).
     * @param {Function} [config.renderPreviewCell] - (record, columnKey) => string (커스텀 셀 렌더링)
     * @param {Function} config.onImportComplete - (records) => void
     * @param {Function} config.getCommonData - () => object
     * @param {Function} [config.validateStep1] - () => {valid:boolean, message?:string}
     * @param {Function} [config.autoNumberFilter] - (log) => boolean (접수번호 채번 시 필터)
     * @param {Function} [config.autoNumberExtract] - (log) => number|NaN (접수번호에서 숫자 추출)
     * @param {boolean} [config.setDefaultDate=true] - importDate 기본값을 오늘로 설정할지 여부
     * @param {Function} [config.postBuildRecords] - (records) => void (레코드 빌드 후 추가 처리)
     */
    constructor(config) {
        this.config = config;

        // 상태
        this._currentStep = 1;
        this._excelHeaders = [];
        this._excelData = [];
        this._columnMapping = {};
        this._parsedLogs = [];

        // DOM 요소 (init에서 캐싱)
        this._els = {};
    }

    /**
     * DOM 요소 캐싱 및 이벤트 리스너 설정
     */
    init() {
        // DOM 요소 캐싱
        this._els = {
            input: document.getElementById('excelImportInput'),
            modal: document.getElementById('excelImportModal'),
            closeBtn: document.getElementById('closeExcelImportModal'),
            cancelBtn: document.getElementById('cancelExcelImportBtn'),
            nextBtn: document.getElementById('excelImportNextBtn'),
            prevBtn: document.getElementById('excelImportPrevBtn'),
            step1: document.getElementById('excelImportStep1'),
            step2: document.getElementById('excelImportStep2'),
            step3: document.getElementById('excelImportStep3'),
            mappingArea: document.getElementById('columnMappingArea'),
            previewHead: document.getElementById('previewTableHead'),
            previewBody: document.getElementById('previewTableBody'),
            previewSummary: document.getElementById('previewSummary'),
            warnings: document.getElementById('importWarnings'),
        };

        // 기본값: 오늘 날짜
        if (this.config.setDefaultDate !== false) {
            const importDateEl = document.getElementById('importDate');
            if (importDateEl) {
                importDateEl.valueAsDate = new Date();
            }
        }

        // 서식 다운로드 버튼
        this._bindDownloadButtons();

        // 파일 선택
        if (this._els.input) {
            this._els.input.addEventListener('change', (e) => this._handleFileSelect(e));
        }

        // 다음/가져오기 버튼
        if (this._els.nextBtn) {
            this._els.nextBtn.addEventListener('click', () => this._handleNext());
        }

        // 이전 버튼
        if (this._els.prevBtn) {
            this._els.prevBtn.addEventListener('click', () => this._handlePrev());
        }

        // 닫기/취소
        const closeHandler = () => this._closeModal();
        if (this._els.closeBtn) {
            this._els.closeBtn.addEventListener('click', closeHandler);
        }
        if (this._els.cancelBtn) {
            this._els.cancelBtn.addEventListener('click', closeHandler);
        }
        // 오버레이 클릭 닫기
        const overlay = this._els.modal?.querySelector('.modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', closeHandler);
        }
    }

    // ========================================
    // 서식 다운로드
    // ========================================

    _bindDownloadButtons() {
        // 서식 다운로드는 가져오기 모달 내부 버튼(downloadTemplateBtn)으로 일원화 (SLS-1-157)
        const modalBtn = document.getElementById('downloadTemplateBtn');
        if (modalBtn) modalBtn.addEventListener('click', () => this._downloadTemplate());
    }

    _downloadTemplate() {
        const tc = this.config.templateConfig;
        const wb = XLSX.utils.book_new();
        const wsData = [tc.headers, tc.sampleRow];
        const ws = XLSX.utils.aoa_to_sheet(sanitizeExcelAoa(wsData));
        ws['!cols'] = tc.colWidths;
        XLSX.utils.book_append_sheet(wb, ws, tc.sheetName);
        XLSX.writeFile(wb, tc.fileName + '.xlsx');
        showToast('서식 파일을 다운로드했습니다.', 'success');
    }

    // ========================================
    // 파일 선택 및 파싱
    // ========================================

    _handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

                if (jsonData.length < 2) {
                    showToast('데이터가 없거나 헤더만 있습니다.', 'error');
                    return;
                }

                this._excelHeaders = jsonData[0].map(h => String(h).trim());
                this._excelData = jsonData.slice(1).filter(row =>
                    row.some(cell => cell !== '' && cell !== null && cell !== undefined)
                );

                if (this._excelData.length === 0) {
                    showToast('데이터 행이 없습니다.', 'error');
                    return;
                }

                // 대량 행 UI 프리즈 방지: 상한 초과 시 잘라내고 경고
                const MAX_IMPORT_ROWS = 5000;
                if (this._excelData.length > MAX_IMPORT_ROWS) {
                    showToast(`행이 너무 많습니다(${this._excelData.length}건). 처음 ${MAX_IMPORT_ROWS}건만 처리합니다.`, 'warning');
                    this._excelData = this._excelData.slice(0, MAX_IMPORT_ROWS);
                }

                // 자동 매핑 수행
                this._autoMap();

                // 모달 열기 (1단계)
                this._currentStep = 1;
                this._showStep(1);
                this._els.modal.classList.remove('hidden');

            } catch (err) {
                console.error('엑셀 파싱 오류:', err);
                showToast('엑셀 파일을 읽을 수 없습니다.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);

        // input 초기화 (같은 파일 다시 선택 가능)
        this._els.input.value = '';
    }

    // ========================================
    // 자동 매핑
    // ========================================

    _autoMap() {
        this._columnMapping = {};
        const rules = this.config.autoMapRules;

        this._excelHeaders.forEach((header, idx) => {
            const normalizedHeader = header.replace(/\s+/g, '').toLowerCase();
            for (const [pattern, field] of Object.entries(rules)) {
                if (normalizedHeader === pattern.replace(/\s+/g, '').toLowerCase() ||
                    header === pattern) {
                    const alreadyMapped = Object.values(this._columnMapping).includes(field);
                    if (!alreadyMapped) {
                        this._columnMapping[idx] = field;
                    }
                    break;
                }
            }
        });
    }

    // ========================================
    // 단계 UI 전환
    // ========================================

    _showStep(step) {
        this._els.step1.classList.toggle('hidden', step !== 1);
        this._els.step2.classList.toggle('hidden', step !== 2);
        this._els.step3.classList.toggle('hidden', step !== 3);
        this._els.prevBtn.classList.toggle('hidden', step === 1);
        this._els.nextBtn.textContent = step === 3 ? '가져오기' : '다음';
    }

    // ========================================
    // 컬럼 매핑 UI
    // ========================================

    _renderColumnMapping() {
        const area = this._els.mappingArea;
        area.innerHTML = '';

        this._excelHeaders.forEach((header, idx) => {
            if (!header) return;

            const row = document.createElement('div');
            row.className = 'mapping-row' + (this._columnMapping[idx] ? ' mapped' : '');

            const sampleValue = this._excelData[0]?.[idx] ?? '';

            const safeHeader = window.escapeHTML(header);
            const safeSampleValue = window.escapeHTML(String(sampleValue || ''));
            row.innerHTML = `
                <span class="mapping-excel-col" title="${safeHeader}">${safeHeader}</span>
                <span class="mapping-arrow">\u2192</span>
                <select class="mapping-select" data-col-idx="${idx}">
                    <option value="">-- 건너뛰기 --</option>
                    ${this.config.appFields.map(f =>
                        `<option value="${window.escapeHTML(f.key)}" ${this._columnMapping[idx] === f.key ? 'selected' : ''}>${window.escapeHTML(f.label)}</option>`
                    ).join('')}
                </select>
                <span class="mapping-sample" title="${safeSampleValue}">예: ${safeSampleValue}</span>
            `;

            const select = row.querySelector('.mapping-select');
            select.addEventListener('change', (e) => {
                const colIdx = parseInt(e.target.dataset.colIdx, 10);
                const value = e.target.value;

                if (value) {
                    // 기존 매핑에서 같은 필드 제거 (중복 방지)
                    for (const [k, v] of Object.entries(this._columnMapping)) {
                        if (v === value && parseInt(k, 10) !== colIdx) {
                            delete this._columnMapping[k];
                            const otherSelect = area.querySelector(`select[data-col-idx="${k}"]`);
                            if (otherSelect) {
                                otherSelect.value = '';
                                otherSelect.closest('.mapping-row').classList.remove('mapped');
                            }
                        }
                    }
                    this._columnMapping[colIdx] = value;
                } else {
                    delete this._columnMapping[colIdx];
                }

                row.classList.toggle('mapped', !!value);
            });

            area.appendChild(row);
        });
    }

    // ========================================
    // 엑셀 날짜 파싱 (공통 유틸)
    // ========================================

    static parseExcelDate(val) {
        if (!val) return '';
        // 이미 문자열 날짜 형식
        if (typeof val === 'string' && val.match(/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/)) {
            return val.replace(/[./]/g, '-');
        }
        // 엑셀 시리얼 날짜 (숫자)
        if (typeof val === 'number' && val > 30000 && val < 100000) {
            const date = new Date((val - 25569) * 86400 * 1000);
            return date.toISOString().slice(0, 10);
        }
        return String(val);
    }

    // ========================================
    // 미리보기 빌드
    // ========================================

    _buildPreview() {
        const commonData = this.config.getCommonData();

        // 역매핑: 앱 필드 → 엑셀 컬럼 인덱스
        const fieldToCol = {};
        for (const [colIdx, field] of Object.entries(this._columnMapping)) {
            fieldToCol[field] = parseInt(colIdx, 10);
        }

        const warnings = [];
        this._parsedLogs = [];

        // getVal 유틸 함수
        const getVal = (row, field) => {
            if (fieldToCol[field] !== undefined) {
                const val = row[fieldToCol[field]];
                return val !== undefined && val !== null ? String(val).trim() : '';
            }
            return '';
        };

        // 각 행 처리
        this._excelData.forEach((row, rowIdx) => {
            // 이 행에 사용자가 **실제로 적은 값**. 기본값·공통값이 섞이기 전이다.
            const rawVal = (field) => getVal(row, field);

            const record = this.config.buildRecord(
                rawVal,
                ExcelImportManager.parseExcelDate,
                commonData,
                rowIdx
            );

            // null 반환 시 건너뛰기 (buildRecord 내부에서 skip 결정)
            if (record === null) return;

            // skipRowCheck 콜백으로 경고/건너뛰기 처리
            //
            // ⚠️ `record`는 **`buildRecord`가 손댄 뒤**의 값이다 (SLS-1-273).
            //    기본값이 채워지거나(예: sampleType) 1단계 공통 입력으로 메워지는
            //    필드(예: name ← common.name)로 "비었는지"를 판정하면
            //    **그 조건은 절대 참이 되지 않는다.** 실제로 compost가 그랬다.
            //    그런 판정에는 세 번째 인자 `raw(field)`를 쓸 것.
            if (this.config.skipRowCheck) {
                const warning = this.config.skipRowCheck(record, rowIdx, rawVal);
                if (warning) {
                    warnings.push(warning);
                    return;
                }
            }

            this._parsedLogs.push(record);
        });

        // 레코드 빌드 후 추가 처리 (예: totalParcels 설정)
        if (this.config.postBuildRecords) {
            this.config.postBuildRecords(this._parsedLogs);
        }

        // 접수번호 자동 채번
        this._autoAssignReceptionNumbers(warnings);

        // 미리보기 테이블 렌더링
        this._renderPreview(warnings);
    }

    // ========================================
    // 접수번호 자동 채번
    // ========================================

    /**
     * 비어 있는 접수번호만 채운다 (SLS-1-270).
     *
     * ⚠️ 예전에는 `some(l => l.receptionNumber !== '')`로 **한 행만 번호가 있어도
     *    배치 전체의 채번을 건너뛰었다.** 나머지 행은 빈 접수번호로 저장됐고,
     *    접수번호는 성적서·흙토람으로 나가는 대외 식별자라 그 자리에서 접수가 무효가 됐다.
     *
     * @param {string[]} [warnings] - 미리보기에 표시할 경고 누적 배열
     */
    _autoAssignReceptionNumbers(warnings) {
        const isBlank = (v) => String(v ?? '').trim() === '';
        const existingLogs = this.config.getExistingLogs ? this.config.getExistingLogs() : [];
        const extractFn = this.config.autoNumberExtract;
        const filterFn = this.config.autoNumberFilter;

        const numberOf = (log) => (extractFn ? extractFn(log) : parseInt(log.receptionNumber, 10));
        // filterFn은 성토(F1)/일반(1)처럼 **별도 시퀀스**를 두기 위한 훅이다.
        // 술어 하나로는 시퀀스를 열거할 수 없으므로 **한 번의 가져오기는 한 시퀀스만 채운다.**
        // 범위 밖 행은 이 시퀀스의 소관이 아니라 손대지 않는다 (그 행이 비어 있으면
        // _handleNext의 가드가 가져오기를 막아 조용히 저장되는 일은 없다).
        const inScope = (log) => !filterFn || filterFn(log);

        const blanks = this._parsedLogs.filter(l => isBlank(l.receptionNumber) && inScope(l));
        if (blanks.length === 0) return;   // 채울 것이 없으면 손대지 않는다

        let maxNum = 0;
        const consider = (raw) => {
            // extractFn이 숫자 문자열을 주던 기존 호환을 지킨다 (!isNaN('5')는 참이었다)
            const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
            // parseInt('400자리')는 Infinity가 된다 — soil의 SLS-1-223과 같은 방어
            if (Number.isSafeInteger(n) && n > maxNum) maxNum = n;
        };

        existingLogs.forEach(log => {
            if (!log.receptionNumber) return;
            if (!inScope(log)) return;
            consider(numberOf(log));
        });
        // 같은 배치에서 사용자가 직접 적은 번호도 점유로 본다 → 자동 채번이 그 위에서 시작한다
        this._parsedLogs.forEach(l => {
            if (isBlank(l.receptionNumber)) return;
            if (!inScope(l)) return;
            consider(numberOf(l));
        });

        // 기존 ∪ 배치 명시 번호의 최대값 위에서 시작하므로 충돌이 구조적으로 불가능하다.
        let next = maxNum;
        let assigned = 0;
        for (const l of blanks) {
            next += 1;
            if (!Number.isSafeInteger(next)) {
                // 조용히 자르지 않는다 — 남은 행은 빈 채로 두고 사용자에게 알린다
                if (warnings) {
                    warnings.push(`접수번호가 다룰 수 있는 범위를 넘어 ${blanks.length - assigned}건은 번호를 매기지 못했습니다. 엑셀에서 접수번호를 채운 뒤 다시 가져와 주세요.`);
                }
                break;
            }
            l.receptionNumber = String(next);
            assigned += 1;
        }
    }

    // ========================================
    // 미리보기 테이블 렌더링
    // ========================================

    _renderPreview(warnings) {
        this._els.previewSummary.textContent = `총 ${this._parsedLogs.length}건의 데이터를 가져옵니다.`;

        // 헤더
        const cols = this.config.previewColumns;
        this._els.previewHead.innerHTML = '<tr>' +
            cols.map(c => `<th>${window.escapeHTML(c.label)}</th>`).join('') +
            '</tr>';

        // 본문
        const renderCell = this.config.renderPreviewCell;
        this._els.previewBody.innerHTML = this._parsedLogs.map(l => {
            const cells = cols.map(c => {
                if (renderCell) {
                    const custom = renderCell(l, c.key);
                    if (custom !== undefined) return '<td>' + window.escapeHTML(String(custom)) + '</td>';
                }
                const val = l[c.key];
                return `<td>${window.escapeHTML(val !== undefined && val !== null ? String(val) : '')}</td>`;
            }).join('');
            return `<tr>${cells}</tr>`;
        }).join('');

        // 경고
        if (warnings.length > 0) {
            this._els.warnings.textContent = warnings.join('\n');
            this._els.warnings.classList.remove('hidden');
        } else {
            this._els.warnings.classList.add('hidden');
        }
    }

    // ========================================
    // 다음/가져오기 버튼 핸들러
    // ========================================

    _handleNext() {
        if (this._currentStep === 1) {
            // Step1 유효성 검증
            if (this.config.validateStep1) {
                const result = this.config.validateStep1();
                if (!result.valid) {
                    showToast(result.message || '입력값을 확인하세요.', 'error');
                    return;
                }
            } else {
                // 기본 검증: 접수일자
                const importDate = document.getElementById('importDate')?.value;
                if (!importDate) {
                    showToast('접수일자를 입력하세요.', 'error');
                    return;
                }
            }

            this._currentStep = 2;
            this._renderColumnMapping();
            this._showStep(2);

        } else if (this._currentStep === 2) {
            if (Object.keys(this._columnMapping).length === 0) {
                showToast('최소 1개의 컬럼을 매핑하세요.', 'error');
                return;
            }

            this._currentStep = 3;
            this._buildPreview();
            this._showStep(3);

        } else if (this._currentStep === 3) {
            if (this._parsedLogs.length === 0) {
                showToast('가져올 데이터가 없습니다.', 'error');
                return;
            }

            // 접수번호 없는 행은 내보내지 않는다 (SLS-1-270).
            // 접수번호는 성적서·흙토람으로 나가는 대외 식별자라 빈 값이면 접수가 무효다.
            // 자동 채번이 못 채운 경우(안전 범위 초과 등)에 경고만 띄우고 통과시키면
            // 이 티켓이 막으려던 상태가 그대로 저장된다.
            const unnumbered = this._parsedLogs.filter(
                l => String(l.receptionNumber ?? '').trim() === ''
            ).length;
            if (unnumbered > 0) {
                showToast(`접수번호가 비어 있는 행이 ${unnumbered}건 있습니다. 엑셀에서 접수번호를 채운 뒤 다시 가져와 주세요.`, 'error');
                return;
            }

            // 가져오기 완료 콜백
            this.config.onImportComplete(this._parsedLogs);

            // 모달 닫기
            this._els.modal.classList.add('hidden');

            showToast(`${this._parsedLogs.length}건의 데이터를 가져왔습니다.`, 'success');

            // 상태 초기화
            this._reset();
        }
    }

    // ========================================
    // 이전 버튼 핸들러
    // ========================================

    _handlePrev() {
        if (this._currentStep === 2) {
            this._currentStep = 1;
            this._showStep(1);
        } else if (this._currentStep === 3) {
            this._currentStep = 2;
            this._showStep(2);
        }
    }

    // ========================================
    // 모달 닫기
    // ========================================

    _closeModal() {
        this._els.modal.classList.add('hidden');
        this._currentStep = 1;
        this._showStep(1);
    }

    // ========================================
    // 상태 초기화
    // ========================================

    _reset() {
        this._parsedLogs = [];
        this._excelData = [];
        this._excelHeaders = [];
        this._columnMapping = {};
    }
}

window.ExcelImportManager = ExcelImportManager;
