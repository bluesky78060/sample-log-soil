/**
 * @fileoverview 퇴·액비 부숙도 검사 위탁서 스크립트
 * CompostSampleManager - BaseSampleManager 상속
 */

// ========================================
// 상수 및 설정
// ========================================

// DEFAULT_SAMPLE_TYPE('가축분퇴비')은 원본에서도 선언만 있고 참조가 없어 제거함 (SLS-1-195)

/** @type {string} */
const SAMPLE_TYPE = 'compost';

/** @type {string} */
const STORAGE_KEY = 'compostSampleLogs';

/** @type {string} */
const AUTO_SAVE_FILE = 'compost-autosave.json';

// ========================================
// CompostSampleManager 클래스
// ========================================

class CompostSampleManager extends window.BaseSampleManager {
    constructor() {
        super({
            moduleKey: 'compost',
            moduleName: '퇴·액비',
            storageKey: STORAGE_KEY,
            sampleType: SAMPLE_TYPE,
            autoSaveFile: AUTO_SAVE_FILE,
            debug: !!window.DEBUG
        });

        // Compost-specific state
        this.currentRegistrationData = null;
        this.listViewStale = true;
        this.currentSearchFilter = {
            dateFrom: '',
            dateTo: '',
            name: '',
            receptionFrom: '',
            receptionTo: '',
            completed: 'incomplete',
            judgment: ''          // SLS-1-203: '' | 'pass' | 'fail' | 'none'
        };
        this.isFullView = false;
        this.autoSaveFileHandle = null;
        this.pendingMailDateIds = [];

        // Compost-specific DOM refs (set in cacheElements)
        this.dateInput = null;
        this.applicantTypeSelect = null;
        this.birthDateField = null;
        this.corpNumberField = null;
        this.birthDateInput = null;
        this.corpNumberInput = null;
        this.animalTypeRadios = null;
        this.animalTypeOtherInput = null;
        this.farmAddressFullInput = null;
        this.farmAreaInput = null;
        this.areaUnitToggle = null;
        this.farmAreaUnitInput = null;
        this.receptionNumberInput = null;
        this.receptionMethodBtns = null;
        this.receptionMethodInput = null;
        this.navSubmitBtn = null;
        this.navResetBtn = null;
        this.selectAllCheckbox = null;

        // Address manager ref
        this.addressPostcode = null;
        this.addressRoad = null;
        this.addressDetail = null;
        this.addressHidden = null;
        this.addressManager = null;

        // Registration result modal refs
        this.registrationResultModal = null;
        this.resultTableBody = null;

        // compost 전용 엑셀 저장 함수 추가
        if (this.FileAPI) {
            this.FileAPI.saveExcel = async function(buffer, suggestedName = 'data.xlsx') {
                if (window.isElectron) {
                    const filePath = await window.electronAPI.saveFileDialog({
                        title: '엑셀 파일 저장',
                        defaultPath: suggestedName,
                        filters: [
                            { name: 'Excel Files', extensions: ['xlsx'] },
                            { name: 'All Files', extensions: ['*'] }
                        ]
                    });
                    if (filePath) {
                        const result = await window.electronAPI.writeFile(filePath, buffer);
                        return result.success;
                    }
                    return false;
                }
                return false;
            };
        }
    }

    // ========================================
    // Override: DOM 요소 캐싱
    // ========================================

    cacheElements() {
        super.cacheElements();

        // Override different IDs
        this.tableBody = document.getElementById('logTableBody');
        this.emptyState = document.getElementById('emptyState');

        // Compost-specific elements
        this.dateInput = document.getElementById('date');
        this.applicantTypeSelect = document.getElementById('applicantType');
        this.birthDateField = document.getElementById('birthDateField');
        this.corpNumberField = document.getElementById('corpNumberField');
        this.birthDateInput = document.getElementById('birthDate');
        this.corpNumberInput = document.getElementById('corpNumber');
        this.animalTypeRadios = document.querySelectorAll('input[name="animalType"]');
        this.animalTypeOtherInput = document.getElementById('animalTypeOther');
        this.farmAddressFullInput = document.getElementById('farmAddressFull');
        this.farmAreaInput = document.getElementById('farmArea');
        this.areaUnitToggle = document.getElementById('areaUnitToggle');
        this.farmAreaUnitInput = document.getElementById('farmAreaUnit');
        this.receptionNumberInput = document.getElementById('receptionNumber');
        this.receptionMethodBtns = document.querySelectorAll('.reception-method-btn');
        this.receptionMethodInput = document.getElementById('receptionMethod');
        this.navSubmitBtn = document.getElementById('navSubmitBtn');
        this.navResetBtn = document.getElementById('navResetBtn');
        this.selectAllCheckbox = document.getElementById('selectAllCheckbox');

        // Address refs
        this.addressPostcode = document.getElementById('addressPostcode');
        this.addressRoad = document.getElementById('addressRoad');
        this.addressDetail = document.getElementById('addressDetail');
        this.addressHidden = document.getElementById('address');

        // Registration result modal refs
        this.registrationResultModal = document.getElementById('registrationResultModal');
        this.resultTableBody = document.getElementById('resultTableBody');
    }

    // ========================================
    // Override: 연락처 자동 하이픈 포맷팅
    // (base의 window.formatPhoneNumber 의존을 SampleUtils 경로로 대체)
    // ========================================

    setupPhoneFormatting() {
        const phoneInput = document.getElementById('phoneNumber');
        if (phoneInput && window.SampleUtils?.setupPhoneNumberInput) {
            window.SampleUtils.setupPhoneNumberInput(phoneInput);
        }
    }

    // ========================================
    // Override: 뷰 초기화
    // ========================================

    initViews() {
        // 오늘 날짜 설정
        if (this.dateInput) {
            this.dateInput.valueAsDate = new Date();
        }

        // 기존 데이터 마이그레이션 (년도 없는 기존 데이터를 현재 년도로 이동)
        const oldData = SampleUtils.safeParseJSON(this.storageKey, []);
        if (oldData.length > 0) {
            const yearKey = this.getStorageKey(this.selectedYear);
            if (!localStorage.getItem(yearKey)) {
                localStorage.setItem(yearKey, JSON.stringify(oldData));
                this.log('기존 데이터를 년도별 저장소로 마이그레이션:', oldData.length, '건');
            }
        }

        // 리스트 뷰 제목 업데이트
        this.updateListViewTitle();
    }

    // ========================================
    // Override: 뷰 전환 (listViewStale 지원)
    // ========================================

    switchView(viewName) {
        const views = document.querySelectorAll('.view');
        const navItems = document.querySelectorAll('.nav-btn');

        views.forEach(view => view.classList.remove('active'));
        navItems.forEach(nav => nav.classList.remove('active'));

        const targetView = document.getElementById(`${viewName}View`);
        const targetNav = document.querySelector(`.nav-btn[data-view="${viewName}"]`);

        if (targetView) targetView.classList.add('active');
        if (targetNav) targetNav.classList.add('active');

        if (viewName === 'list' && this.listViewStale) {
            this.filterAndRenderLogs();
            this.listViewStale = false;
        }
    }

    // ========================================
    // Override: 레코드 수 업데이트 (총 접두사 없음)
    // ========================================

    updateRecordCount() {
        if (!this.recordCountEl) return;
        const total = this.sampleLogs.length;
        const incomplete = this.sampleLogs.filter(log => !log.isComplete).length;
        if (incomplete > 0) {
            this.recordCountEl.textContent = `${total}건 (미완료 ${incomplete}건)`;
        } else {
            this.recordCountEl.textContent = `${total}건`;
        }
    }

    // onYearChange는 이 클래스 하단(검정결과 캐시 무효화 포함 버전)에 정의되어 있다.
    // 원본에 있던 축약 중복 정의는 뒤 정의에 덮여 도달 불가였으므로 제거함 (SLS-1-195).

    // ========================================
    // Override: 완료 필드 마이그레이션 (SLS-1-195)
    // ========================================

    /**
     * base는 completed 필드를 채우지만 퇴비는 전 구간 isComplete만 사용한다.
     * base 구현을 그대로 두면 loadYearData마다 무의미한 completed:false가 주입되고
     * saveLogs() → batchSave 경로로 Firestore 문서까지 오염된다.
     * 토양은 soil-script.js가 자체 오버라이드하므로 이 결정의 영향을 받지 않는다.
     * @param {Array} logs
     * @returns {Array} 원본 그대로
     */
    migrateCompletedField(logs) {
        return logs;
    }

    // onBeforeSave: BaseSampleManager.saveLogs에서 listViewStale 설정하므로 별도 오버라이드 불필요
    //
    // SLS-1-204: loadYearData 오버라이드(_yearDataLoaded 플래그)를 제거했다.
    //   이 플래그의 유일한 소비처가 syncCompostTestResultsFromFirestore였고(SLS-1-196의
    //   await 없는 호출과 경쟁하는 문제), 검정결과 Firestore 동기화 자체가 사라져
    //   판별할 경합이 없다. 검정결과는 이제 localStorage 동기 읽기/쓰기뿐이다.

    // ========================================
    // Override: 저장 후 hook (자동 저장)
    // ========================================

    onAfterSave(data) {
        // SLS-1-206: 이 페이지가 저장한 내용이 되돌아와 헛도는 재렌더를 만들지 않도록
        //   교차 창 감지의 기준값을 여기서 맞춘다. 안 하면 focus할 때마다
        //   "바뀌었다"고 판단해 전건을 다시 파싱하고 목록을 다시 그린다.
        this._lastLogsRaw = localStorage.getItem(this.getStorageKey(this.selectedYear));

        // 자동 저장 (Electron 환경)
        if (window.isElectron && this.FileAPI?.autoSavePath && document.getElementById('autoSaveToggle')?.checked) {
            const autoSaveContent = JSON.stringify(data, null, 2);
            this.FileAPI.autoSave(autoSaveContent);
        }
    }

    // ========================================
    // Override: 테이블 행 빌드 (PaginationManager용)
    // ========================================

    buildTableRow(logItem, index) {
        const row = document.createElement('tr');
        row.dataset.id = logItem.id;

        const sampleTypeBadge = this.getSampleTypeBadge(logItem.sampleType);
        const animalTypeBadge = this.getAnimalTypeBadge(logItem.animalType);
        const fullAddress = [logItem.addressRoad, logItem.addressDetail].filter(Boolean).join(' ') || '-';
        // 뷰용 주소: 시도 패턴이 있을 때만 제거
        const displayAddress = fullAddress !== '-' && SIDO_PATTERN.test(fullAddress)
            ? fullAddress.replace(SIDO_PATTERN, '')
            : fullAddress;

        // 🚨 여기서 escapeHTML을 쓰지 않는다 (SLS-1-249 적대적 검증에서 잡힘).
        //    아래 여섯 값은 전부 textContent · title · dataset.tooltip 으로만 나간다.
        //    그 셋은 **HTML을 파싱하지 않는 텍스트 싱크**라 이스케이프가 필요 없고,
        //    미리 이스케이프하면 엔티티가 **글자 그대로** 보인다:
        //
        //        홍길동 & 김철수  →  홍길동 &amp; 김철수
        //        가격<중요>       →  가격&lt;중요&gt;
        //
        //    이건 예전부터 있던 결함이다(escapeHTML이 &·<·>는 원래 바꿨으므로).
        //    escapeHTML이 따옴표까지 처리하게 되면서 `홍"길동 → 홍&quot;길동`이 추가로
        //    깨질 참이었다. 원본을 그대로 넣는 것이 옳다 — 텍스트 싱크가 알아서 안전하다.
        //    ⚠️ 이 변수들을 innerHTML 쪽으로 옮길 일이 생기면 그때는 반드시 escapeHTML을 씌운다.
        const safeFarmName = logItem.farmName || logItem.companyName || '-';
        const safeName = logItem.name || '-';
        const safeDisplayAddress = displayAddress;
        const safeFarmAddress = logItem.farmAddress || '-';
        const displayPhone = logItem.phoneNumber && window.SampleUtils?.formatPhoneNumber
            ? (window.SampleUtils.formatPhoneNumber(logItem.phoneNumber) || logItem.phoneNumber)
            : (logItem.phoneNumber || '-');
        const safePhone = displayPhone;
        const safeNote = logItem.note || '-';

        // 법인여부 및 생년월일/법인번호
        const applicantType = logItem.applicantType || '개인';
        const birthOrCorp = applicantType === '법인' ? (logItem.corpNumber || '-') : (logItem.birthDate || '-');

        // 1. Checkbox column
        const tdCheckbox = document.createElement('td');
        tdCheckbox.className = 'col-checkbox sticky-col';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'row-checkbox';
        checkbox.dataset.id = logItem.id;
        tdCheckbox.appendChild(checkbox);
        row.appendChild(tdCheckbox);

        // 2. Complete button column
        const tdComplete = document.createElement('td');
        tdComplete.className = 'col-complete sticky-col';
        const btnComplete = document.createElement('button');
        btnComplete.className = `btn-complete ${logItem.isComplete ? 'completed' : ''}`;
        btnComplete.dataset.id = logItem.id;
        btnComplete.title = logItem.isComplete ? '완료됨' : '완료 표시';
        btnComplete.textContent = logItem.isComplete ? '✅' : '⬜';
        tdComplete.appendChild(btnComplete);
        row.appendChild(tdComplete);

        // 3. Result button column
        const tdResult = document.createElement('td');
        tdResult.className = 'col-result sticky-col';
        const btnResult = document.createElement('button');
        btnResult.className = `btn-result ${logItem.testResult === 'pass' ? 'pass' : logItem.testResult === 'fail' ? 'fail' : ''}`;
        btnResult.dataset.id = logItem.id;
        btnResult.title = logItem.testResult === 'pass' ? '적합' : logItem.testResult === 'fail' ? '부적합' : '미판정 (클릭하여 변경)';
        btnResult.textContent = logItem.testResult === 'pass' ? '적합' : logItem.testResult === 'fail' ? '부적합' : '-';
        tdResult.appendChild(btnResult);
        row.appendChild(tdResult);

        // 3-1. Maturity level (부숙도) dropdown
        const tdMaturity = document.createElement('td');
        tdMaturity.className = 'col-maturity sticky-col';
        const selectMaturity = document.createElement('select');
        selectMaturity.className = 'maturity-select';
        selectMaturity.dataset.id = logItem.id;
        const maturityOptions = window.CompostFields.MATURITY_OPTIONS;
        maturityOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.textContent = opt || '-';
            if (logItem.maturity === opt) option.selected = true;
            selectMaturity.appendChild(option);
        });
        tdMaturity.appendChild(selectMaturity);
        row.appendChild(tdMaturity);

        // 3-2. Moisture content (함수율) input
        const tdMoisture = document.createElement('td');
        tdMoisture.className = 'col-moisture sticky-col';
        const inputMoisture = document.createElement('input');
        inputMoisture.type = 'text';
        inputMoisture.className = 'moisture-input';
        inputMoisture.dataset.id = logItem.id;
        inputMoisture.value = logItem.moisture || '';
        inputMoisture.placeholder = '%';
        inputMoisture.maxLength = 10;
        tdMoisture.appendChild(inputMoisture);
        row.appendChild(tdMoisture);

        // 4. Reception number
        const tdReceptionNumber = document.createElement('td');
        tdReceptionNumber.className = 'col-num sticky-col';
        tdReceptionNumber.textContent = logItem.receptionNumber || '-';
        row.appendChild(tdReceptionNumber);

        // 5. Date
        const tdDate = document.createElement('td');
        tdDate.className = 'col-date sticky-col';
        tdDate.textContent = logItem.date || '-';
        row.appendChild(tdDate);

        // 6. Applicant type (hidden)
        const tdApplicantType = document.createElement('td');
        tdApplicantType.className = 'col-applicant-type col-hidden';
        tdApplicantType.textContent = applicantType;
        row.appendChild(tdApplicantType);

        // 7. Birth/Corp number (hidden)
        const tdBirthCorp = document.createElement('td');
        tdBirthCorp.className = 'col-birth-corp col-hidden';
        tdBirthCorp.textContent = birthOrCorp;
        row.appendChild(tdBirthCorp);

        // 8. Farm name
        const tdFarmName = document.createElement('td');
        tdFarmName.className = 'col-farm-name sticky-col';
        tdFarmName.textContent = safeFarmName;
        row.appendChild(tdFarmName);

        // 9. Name (클릭 시 같은 이름 일괄 선택)
        const tdName = document.createElement('td');
        tdName.className = 'col-name sticky-col';
        tdName.dataset.name = logItem.name || '';
        tdName.textContent = safeName;
        tdName.title = `"${safeName}" 클릭하면 같은 이름 일괄 선택`;
        row.appendChild(tdName);

        // 10. Postcode (hidden)
        const tdPostcode = document.createElement('td');
        tdPostcode.className = 'col-postcode col-hidden';
        tdPostcode.textContent = logItem.addressPostcode || '-';
        row.appendChild(tdPostcode);

        // 11. Address - 뷰에서는 시도 제외하고 전체 표시
        const tdAddress = document.createElement('td');
        tdAddress.className = 'col-address';
        tdAddress.textContent = safeDisplayAddress;
        row.appendChild(tdAddress);

        // 12. Farm address
        const tdFarmAddress = document.createElement('td');
        tdFarmAddress.className = 'col-farm-address';
        tdFarmAddress.textContent = safeFarmAddress;
        row.appendChild(tdFarmAddress);

        // 13. Farm area (평이면 m2로 환산해서 표시)
        const tdFarmArea = document.createElement('td');
        if (logItem.farmArea) {
            const areaValue = parseInt(logItem.farmArea, 10);
            if (logItem.farmAreaUnit === 'pyeong') {
                // 평 -> m2 환산 (1평 = 3.3058 m2)
                const m2Value = Math.round(areaValue * 3.3058);
                tdFarmArea.textContent = m2Value.toLocaleString('ko-KR') + ' m\u00B2';
            } else {
                tdFarmArea.textContent = areaValue.toLocaleString('ko-KR') + ' m\u00B2';
            }
        } else {
            tdFarmArea.textContent = '-';
        }
        row.appendChild(tdFarmArea);

        // 14. Sample type badge
        const tdSampleType = document.createElement('td');
        tdSampleType.innerHTML = sampleTypeBadge;
        row.appendChild(tdSampleType);

        // 15. Animal type badge
        const tdAnimalType = document.createElement('td');
        tdAnimalType.innerHTML = animalTypeBadge;
        row.appendChild(tdAnimalType);

        // 16. Production date
        const tdProductionDate = document.createElement('td');
        tdProductionDate.textContent = logItem.productionDate || '-';
        row.appendChild(tdProductionDate);

        // 17. Purpose
        const tdPurpose = document.createElement('td');
        tdPurpose.textContent = logItem.purpose || '-';
        row.appendChild(tdPurpose);

        // 18. Phone
        const tdPhone = document.createElement('td');
        tdPhone.textContent = safePhone;
        row.appendChild(tdPhone);

        // 19. Reception method
        const tdReceptionMethod = document.createElement('td');
        tdReceptionMethod.textContent = logItem.receptionMethod || '-';
        row.appendChild(tdReceptionMethod);

        // 20. Note (with tooltip)
        const tdNote = document.createElement('td');
        tdNote.className = 'col-note text-truncate';
        tdNote.dataset.tooltip = safeNote;
        tdNote.textContent = safeNote;
        row.appendChild(tdNote);

        // 21. Mail date
        const tdMailDate = document.createElement('td');
        tdMailDate.className = 'col-mail-date';
        tdMailDate.textContent = logItem.mailDate || '-';
        row.appendChild(tdMailDate);

        // 22. Analysis result button
        const tdAnalysis = document.createElement('td');
        tdAnalysis.className = 'col-analysis';
        const btnAnalysis = document.createElement('button');
        btnAnalysis.className = 'btn-analysis-open';
        btnAnalysis.dataset.id = logItem.id;
        btnAnalysis.title = '분석결과 입력/수정';
        const existingResult = this.loadCompostTestResult(logItem.id);
        if (existingResult && (existingResult.moisture || existingResult.maturity)) {
            btnAnalysis.classList.add('has-result');
            btnAnalysis.textContent = '결과확인';
        } else {
            btnAnalysis.textContent = '결과입력';
        }
        tdAnalysis.appendChild(btnAnalysis);
        row.appendChild(tdAnalysis);

        // 23. Action buttons (edit/delete)
        const tdAction = document.createElement('td');
        tdAction.className = 'col-action sticky-col';
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-edit';
        btnEdit.dataset.id = logItem.id;
        btnEdit.title = '수정';
        btnEdit.textContent = '✏️';
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn-delete';
        btnDelete.dataset.id = logItem.id;
        btnDelete.title = '삭제';
        btnDelete.textContent = '🗑️';
        tdAction.appendChild(btnEdit);
        tdAction.appendChild(btnDelete);
        row.appendChild(tdAction);

        if (logItem.isComplete) {
            row.classList.add('row-completed');
        }

        return row;
    }

    // ========================================
    // Override: 폼 제출
    // ========================================

    submitForm() {
        const formData = new FormData(this.form);

        // 축종 (기타 선택 시 입력값 사용)
        let animalType = formData.get('animalType');
        if (animalType === '기타') {
            animalType = this.animalTypeOtherInput.value || '기타';
        }

        if (this.editingId) {
            // === 수정 모드 ===
            const log = this.sampleLogs.find(l => l.id === this.editingId);
            if (log) {
                Object.assign(log, this.collectCommonFormData(formData), {
                    receptionNumber: formData.get('receptionNumber'),
                    farmName: formData.get('farmName'),
                    farmAddress: formData.get('farmAddressFull'),
                    farmArea: this.parseFormattedNumber(formData.get('farmArea') || ''),
                    farmAreaUnit: formData.get('farmAreaUnit') || 'm2',
                    sampleType: formData.get('sampleType'),
                    animalType: animalType,
                    productionDate: formData.get('productionDate'),
                    samplingDate: formData.get('samplingDate'),
                    businessNumber: formData.get('businessNumber'),
                    isFarm: formData.get('isFarm'),
                    fertilizerLawApplies: formData.get('fertilizerLawApplies'),
                    sampleCount: formData.get('sampleCount') || '1',
                    rawMaterials: formData.get('rawMaterials'),
                    updatedAt: new Date().toISOString()
                });

                this.saveLogs();
                this.showToast('수정이 완료되었습니다.', 'success');
                this.resetForm();
                this.receptionNumberInput.value = this.generateNextReceptionNumber();
                this.editingId = null;

                // 제출 버튼 원래대로
                if (this.navSubmitBtn) {
                    this.navSubmitBtn.title = '접수 등록';
                    this.navSubmitBtn.classList.remove('btn-edit-mode');
                }

                // 목록 뷰로 전환
                this.switchView('list');
            } else {
                // SLS-1-206: 다른 창이 이 항목을 지웠다. 교차 창 갱신이 들어오면서
                // sampleLogs에서 사라진 상태다. 안내 없이 넘기면 입력한 내용이
                // 아무 반응 없이 사라진 것처럼 보인다.
                this.showToast('다른 창에서 삭제된 항목입니다. 수정 내용을 저장할 수 없습니다.', 'error');
                this.resetForm();
                this.receptionNumberInput.value = this.generateNextReceptionNumber();
                this.editingId = null;
                if (this.navSubmitBtn) {
                    this.navSubmitBtn.title = '접수 등록';
                    this.navSubmitBtn.classList.remove('btn-edit-mode');
                }
                this.switchView('list');
            }
        } else {
            // === 신규 등록 모드 ===
            const data = {
                id: this.generateId(),
                ...this.collectCommonFormData(formData),
                receptionNumber: formData.get('receptionNumber'),
                farmName: formData.get('farmName'),
                farmAddress: formData.get('farmAddressFull'),
                farmArea: this.parseFormattedNumber(formData.get('farmArea') || ''),
                farmAreaUnit: formData.get('farmAreaUnit') || 'm2',
                sampleType: formData.get('sampleType'),
                animalType: animalType,
                productionDate: formData.get('productionDate'),
                samplingDate: formData.get('samplingDate'),
                businessNumber: formData.get('businessNumber'),
                isFarm: formData.get('isFarm'),
                fertilizerLawApplies: formData.get('fertilizerLawApplies'),
                sampleCount: formData.get('sampleCount') || '1',
                rawMaterials: formData.get('rawMaterials'),
                isComplete: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            this.sampleLogs.push(data);
            this.saveLogs();

            this.showToast('시료가 등록되었습니다.', 'success');
            this.showRegistrationResult(data);

            this.resetForm();
            this.receptionNumberInput.value = this.generateNextReceptionNumber();
        }
    }

    // ========================================
    // Override: 샘플 편집
    // ========================================

    // Override: 타입 고유 편집 필드 (의뢰자 농장명/농장정보/축종/시료종류/생산정보/목적)
    populateTypeSpecificFields(log) {
        // 의뢰자 농장명
        document.getElementById('farmName').value = log.farmName || '';

        // 농장 정보
        if (this.farmAddressFullInput) {
            this.farmAddressFullInput.value = log.farmAddress || '';
        }
        document.getElementById('farmArea').value = log.farmArea ? this.formatNumberWithCommas(log.farmArea) : '';

        // 면적 단위 복원
        const savedUnit = log.farmAreaUnit || 'm2';
        if (this.areaUnitToggle) {
            this.areaUnitToggle.dataset.unit = savedUnit;
            this.areaUnitToggle.querySelectorAll('.unit-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.value === savedUnit);
            });
        }
        if (this.farmAreaUnitInput) {
            this.farmAreaUnitInput.value = savedUnit;
        }

        // 시료종류 설정
        const sampleTypeRadios = document.querySelectorAll('input[name="sampleType"]');
        sampleTypeRadios.forEach(radio => {
            radio.checked = radio.value === log.sampleType;
        });

        // 축종 설정
        let animalTypeFound = false;
        this.animalTypeRadios.forEach(radio => {
            if (radio.value === log.animalType) {
                radio.checked = true;
                animalTypeFound = true;
            } else if (radio.value === '기타' && !animalTypeFound && log.animalType && !['소', '돼지', '닭·오리 등'].includes(log.animalType)) {
                radio.checked = true;
                this.animalTypeOtherInput.value = log.animalType;
                this.animalTypeOtherInput.classList.remove('hidden');
            }
        });

        // 생산 정보
        document.getElementById('productionDate').value = log.productionDate || '';
        document.getElementById('sampleCount').value = log.sampleCount || 1;
        document.getElementById('rawMaterials').value = log.rawMaterials || '';

        // SLS-1-200: 흙토람 일괄입력용 항목. 여기서 빠뜨리면 편집 폼에 값이 안 채워지고,
        //   그대로 저장하면 formData가 빈 문자열을 반환해 **기존 값이 조용히 덮인다.**
        //   비료관리법 해당여부가 날아가면 흙토람에서 판정 기준이 바뀐다.
        document.getElementById('samplingDate').value = log.samplingDate || '';
        document.getElementById('businessNumber').value = log.businessNumber || '';
        document.getElementById('isFarm').value = log.isFarm || '';
        document.getElementById('fertilizerLawApplies').value = log.fertilizerLawApplies || '';
        document.getElementById('purpose').value = log.purpose || '';
    }

    // ========================================
    // Override: 폼 초기화
    // ========================================

    // Override: 리셋 시 접수일자 보존 (Base 골격 사용)
    shouldPreserveDateOnReset() {
        return true;
    }

    // Override: 리셋 후 타입 고유 초기화 (통보방법/법인/시료종류/축종/면적단위)
    onAfterFormReset() {
        // 통보방법 초기화
        this.receptionMethodBtns.forEach(b => b.classList.remove('active'));
        this.receptionMethodInput.value = '';

        // 개인/법인 초기화
        if (this.applicantTypeSelect) {
            this.applicantTypeSelect.value = '개인';
            this.birthDateField.classList.remove('hidden');
            this.corpNumberField.classList.add('hidden');
        }
        if (this.birthDateInput) this.birthDateInput.value = '';
        if (this.corpNumberInput) this.corpNumberInput.value = '';

        // 시료종류 초기화 (첫 번째 라디오 선택)
        const sampleTypeRadios = document.querySelectorAll('input[name="sampleType"]');
        if (sampleTypeRadios.length > 0) {
            sampleTypeRadios[0].checked = true;
        }

        // 축종 초기화 (첫 번째 라디오 선택)
        if (this.animalTypeRadios.length > 0) {
            this.animalTypeRadios[0].checked = true;
        }
        this.animalTypeOtherInput.classList.add('hidden');
        this.animalTypeOtherInput.value = '';

        // 면적 단위 초기화
        if (this.areaUnitToggle) {
            this.areaUnitToggle.dataset.unit = 'm2';
            this.areaUnitToggle.querySelectorAll('.unit-btn').forEach(b => {
                b.classList.toggle('active', b.dataset.value === 'm2');
            });
        }
        if (this.farmAreaUnitInput) {
            this.farmAreaUnitInput.value = 'm2';
        }
    }

    // ========================================
    // Override: 타입별 이벤트 설정
    // ========================================

    setupTypeSpecificEvents() {
        // -- 주소 검색 (AddressManager) --
        this.addressManager = new window.AddressManager({
            searchBtn: document.getElementById('searchAddressBtn'),
            postcodeInput: this.addressPostcode,
            roadInput: this.addressRoad,
            detailInput: this.addressDetail,
            hiddenInput: this.addressHidden,
            modal: document.getElementById('addressModal'),
            closeBtn: document.getElementById('closeAddressModal'),
            container: document.getElementById('daumPostcodeContainer')
        });

        // -- 개인/법인 선택 전환 --
        if (this.applicantTypeSelect) {
            this.applicantTypeSelect.addEventListener('change', () => {
                const isCorpSelected = this.applicantTypeSelect.value === '법인';
                if (isCorpSelected) {
                    this.birthDateField.classList.add('hidden');
                    this.corpNumberField.classList.remove('hidden');
                    this.birthDateInput.value = '';
                } else {
                    this.birthDateField.classList.remove('hidden');
                    this.corpNumberField.classList.add('hidden');
                    this.corpNumberInput.value = '';
                }
            });
        }

        // -- 법인번호 자동 하이픈 --
        if (this.corpNumberInput) {
            this.corpNumberInput.addEventListener('input', (e) => {
                let value = e.target.value.replace(/[^0-9]/g, '');
                if (value.length > 13) value = value.slice(0, 13);
                if (value.length > 6) {
                    value = value.slice(0, 6) + '-' + value.slice(6);
                }
                e.target.value = value;
            });
        }

        // -- 전화번호 자동 하이픈 (공통 모듈 사용) --
        const phoneNumberInput = document.getElementById('phoneNumber');
        window.SampleUtils.setupPhoneNumberInput(phoneNumberInput);

        // -- 통보방법 선택 --
        this.receptionMethodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.receptionMethodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.receptionMethodInput.value = btn.dataset.method;
            });
        });

        // -- 축종 기타 입력 필드 처리 --
        this.animalTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === '기타' && radio.checked) {
                    this.animalTypeOtherInput.classList.remove('hidden');
                    this.animalTypeOtherInput.focus();
                } else {
                    this.animalTypeOtherInput.classList.add('hidden');
                    this.animalTypeOtherInput.value = '';
                }
            });
        });

        // -- 면적 천단위 콤마 포맷팅 --
        if (this.farmAreaInput) {
            this.farmAreaInput.addEventListener('input', (e) => {
                const formatted = this.formatNumberWithCommas(e.target.value);
                e.target.value = formatted;
            });
        }

        // -- 면적 단위 토글 --
        if (this.areaUnitToggle) {
            this.areaUnitToggle.querySelectorAll('.unit-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const value = btn.dataset.value;
                    this.areaUnitToggle.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.areaUnitToggle.dataset.unit = value;
                    if (this.farmAreaUnitInput) {
                        this.farmAreaUnitInput.value = value;
                    }
                });
            });
        }

        // -- 접수번호 초기 설정 --
        if (this.receptionNumberInput) {
            this.receptionNumberInput.value = this.generateNextReceptionNumber();
        }

        // -- 네비게이션 접수/초기화 버튼 --
        if (this.navSubmitBtn) {
            this.navSubmitBtn.addEventListener('click', () => {
                if (this.form.checkValidity()) {
                    this.submitForm();
                } else {
                    this.form.reportValidity();
                }
            });
        }
        if (this.navResetBtn) {
            this.navResetBtn.addEventListener('click', () => {
                if (confirm('입력한 내용을 모두 초기화하시겠습니까?')) {
                    this.resetForm();
                }
            });
        }

        // -- 빈 상태에서 "새 시료 접수하기" 버튼 --
        const btnGoForm = document.querySelector('.btn-go-form');
        if (btnGoForm) {
            btnGoForm.addEventListener('click', () => this.switchView('form'));
        }

        // -- 오늘 날짜 설정 (dateInput은 이미 initViews에서 설정) --

        // -- 등록 결과 모달 이벤트 --
        this.setupRegistrationResultModal();

        // -- 테이블 이벤트 위임 (compost-specific) --
        this.setupCompostTableEvents();

        // -- 전체 선택 / 선택 삭제 --
        this.setupBulkActions();

        // -- 라벨 인쇄 --
        this.setupLabelPrint();

        // -- 일괄 우편발송일자 --
        this.setupBulkMailDate();

        // -- 통계 모달 --
        this.setupStatisticsModal();

        // -- 검색 모달 --
        this.setupSearchModal();

        // -- 엑셀 내보내기 --
        this.setupExcelExport();

        // -- JSON 저장/불러오기 --
        this.setupJSONHandlers();

        // -- 자동 저장 설정 --
        this.setupAutoSaveHandlers();

        // -- 전체 보기/기본 보기 토글 --
        this.setupColumnToggle();

        // -- 농장주소 자동완성 --
        this.bindFarmAddressAutocomplete();

        // -- 엑셀 가져오기 (ExcelImportManager) --
        this.setupExcelImport();

        // -- Electron 자동 저장 파일 로드 --
        this.loadAutoSaveOnInit();

        // -- 다른 창의 저장소 변경 감지 (SLS-1-206) --
        this.setupCrossWindowSync();
    }

    /**
     * 검정결과 화면(src/compost-analysis/)은 별도 창이다. 거기서 저장하면
     * localStorage는 바뀌지만 이 페이지의 메모리 sampleLogs는 그대로라
     * **입력한 값이 목록에 나타나지 않는다**(새로고침해야 보인다).
     *
     * SLS-1-205 코드리뷰 MAJOR-3의 반대 방향이다 — 그때는 팝업이 낡는 것만 고쳤다.
     */
    setupCrossWindowSync() {
        // 기준값을 지금 맞춰 둔다. 안 하면 undefined와 비교하게 되어
        // 첫 focus에서 변경이 없는데도 한 번 헛돌아 전건을 다시 그린다.
        this._lastLogsRaw = localStorage.getItem(this.getStorageKey(this.selectedYear));
        this._lastResultsRaw = localStorage.getItem(`compostTestResults_${this.selectedYear}`);

        const watched = () => [
            `compostSampleLogs_${this.selectedYear}`,
            `compostTestResults_${this.selectedYear}`,
        ];

        // 같은 origin의 다른 창/탭이 localStorage를 바꾸면 발생한다.
        window.addEventListener('storage', (e) => {
            if (e.key && watched().includes(e.key)) this.refreshFromStorage();
        });

        // 폴백 — Electron file:// 환경에서는 storage 이벤트가 전달되지 않을 수 있다.
        // 창이 다시 앞으로 나올 때 저장소를 다시 읽는다.
        window.addEventListener('focus', () => this.refreshFromStorage());
    }

    /**
     * 저장소를 다시 읽어 목록만 갱신한다.
     *
     * ⚠️ 폼은 건드리지 않는다 — 편집 중이면 입력하던 내용이 날아간다.
     * ⚠️ 변경이 없으면 재렌더하지 않는다 — focus마다 전건 재파싱하면 큰 연도에서 체감된다.
     *
     * 두 저장소를 **따로** 본다. 접수 데이터만 보고 조기 반환하면, 검정결과만 바뀐 경우
     * (예: 검사일자 일괄 적용 — 함수율·부숙도를 건드리지 않아 접수 데이터가 그대로다)
     * 캐시가 안 비워져 버튼 라벨(결과입력/결과확인)이 낡은 채로 남는다.
     */
    refreshFromStorage() {
        const raw = localStorage.getItem(this.getStorageKey(this.selectedYear));
        const resultsRaw = localStorage.getItem(`compostTestResults_${this.selectedYear}`);
        const logsChanged = raw !== this._lastLogsRaw;
        const resultsChanged = resultsRaw !== this._lastResultsRaw;
        if (!logsChanged && !resultsChanged) return;

        this._lastLogsRaw = raw;
        this._lastResultsRaw = resultsRaw;

        if (logsChanged) {
            let parsed;
            try {
                parsed = JSON.parse(raw || '[]');
            } catch (e) {
                (window.logger?.warn || console.warn)('접수 데이터 재읽기 실패 — 기존 데이터 유지:', e);
                parsed = null;
            }
            if (Array.isArray(parsed)) this.sampleLogs = parsed;
        }

        // 캐시를 비워야 버튼 라벨(결과입력/결과확인)이 갱신된다
        if (resultsChanged) this._cachedCompostResults = null;
        this.filterAndRenderLogs();
    }

    // ========================================
    // 등록 결과 모달
    // ========================================

    setupRegistrationResultModal() {
        const closeRegistrationModal = document.getElementById('closeRegistrationModal');
        const closeResultBtn = document.getElementById('closeResultBtn');
        const editResultBtn = document.getElementById('editResultBtn');

        if (closeRegistrationModal) {
            closeRegistrationModal.addEventListener('click', () => this.closeRegistrationResultModal());
        }
        if (closeResultBtn) {
            closeResultBtn.addEventListener('click', () => this.closeRegistrationResultModal());
        }
        if (editResultBtn) {
            editResultBtn.addEventListener('click', () => {
                if (this.currentRegistrationData) {
                    const dataToEdit = this.currentRegistrationData;
                    this.closeRegistrationResultModal();
                    this.editSample(String(dataToEdit.id));
                }
            });
        }
        // SLS-1-194: 195 이식 때 마크업만 넘어오고 핸들러가 누락돼 있었다.
        // 등록 직후 모달의 주 강조 버튼이라 무반응이면 첫 사용자가 가장 먼저 부딪힌다.
        const exportResultBtn = document.getElementById('exportResultBtn');
        if (exportResultBtn) {
            exportResultBtn.addEventListener('click', () => this.exportRegistrationResult());
        }
        if (this.registrationResultModal) {
            this.registrationResultModal.querySelector('.modal-overlay').addEventListener('click', () => this.closeRegistrationResultModal());
        }
    }

    /**
     * 등록 결과 표의 행 구성 (화면 표시와 엑셀 내보내기가 공유)
     * @param {Object} data - 접수 레코드
     * @returns {Array<{label: string, value: *}>}
     */
    buildRegistrationRows(data) {
        return [
            { label: '접수번호', value: data.receptionNumber },
            { label: '접수일자', value: data.date },
            { label: '상호(농장명)', value: data.farmName },
            { label: '성명(대표자)', value: data.name },
            { label: '연락처', value: data.phoneNumber },
            { label: '시료종류', value: data.sampleType },
            { label: '축종', value: data.animalType },
            { label: '생산일자', value: data.productionDate },
            { label: '시료수', value: `${data.sampleCount || 1}점` },
            { label: '원료 및 투입비율', value: data.rawMaterials },
            { label: '목적(용도)', value: data.purpose },
            { label: '통보방법', value: data.receptionMethod },
            { label: '비고', value: data.note }
        ];
    }

    showRegistrationResult(data) {
        if (!this.registrationResultModal || !this.resultTableBody) return;

        this.currentRegistrationData = data;
        BaseSampleManager.buildResultTable(this.resultTableBody, this.buildRegistrationRows(data));
        this.registrationResultModal.classList.remove('hidden');
    }

    /**
     * 등록 결과를 엑셀로 내보내기 (SLS-1-194)
     * 화면에 표시 중인 것과 동일한 항목/내용 2열 구조로 저장한다.
     * 목록 내보내기(setupExcelExport)와 동일한 배관을 쓴다 — sanitizeExcelData → json_to_sheet →
     * Electron은 FileAPI.saveExcel, 웹은 XLSX.writeFile.
     */
    exportRegistrationResult() {
        const data = this.currentRegistrationData;
        if (!data) {
            this.showToast('내보낼 접수 정보가 없습니다.', 'warning');
            return;
        }

        const excelData = this.buildRegistrationRows(data).map(r => ({
            '항목': r.label,
            '내용': (r.value === undefined || r.value === null || r.value === '') ? '-' : String(r.value)
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sanitizeExcelData(excelData));
        ws['!cols'] = [{ wch: 18 }, { wch: 45 }];
        XLSX.utils.book_append_sheet(wb, ws, '접수확인서');

        const safeReception = String(data.receptionNumber || '').replace(/[^\w가-힣-]/g, '');
        const fileName = `퇴액비_접수확인서_${safeReception || 'unknown'}_${new Date().toISOString().split('T')[0]}.xlsx`;

        if (window.isElectron) {
            const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
            this.FileAPI.saveExcel(xlsxData, fileName).then(saved => {
                if (saved) this.showToast('엑셀 파일로 내보내기 완료', 'success');
            });
        } else {
            XLSX.writeFile(wb, fileName);
            this.showToast('엑셀 파일로 내보내기 완료', 'success');
        }
    }

    closeRegistrationResultModal() {
        if (this.registrationResultModal) {
            this.registrationResultModal.classList.add('hidden');
        }
        this.currentRegistrationData = null;
    }

    // ========================================
    // 테이블 이벤트 위임 (compost-specific)
    // ========================================

    setupCompostTableEvents() {
        if (!this.tableBody) return;

        // 클릭 이벤트 위임
        this.tableBody.addEventListener('click', (e) => {
            // select, input 요소 클릭 시 이벤트 무시 (드롭다운/입력 동작 보호)
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.tagName === 'OPTION') {
                return;
            }

            // 완료 버튼
            const completeBtn = e.target.closest('.btn-complete');
            if (completeBtn) {
                const id = completeBtn.dataset.id;
                this.toggleComplete(id);
                return;
            }

            // 판정 버튼
            const resultBtn = e.target.closest('.btn-result');
            if (resultBtn) {
                const id = resultBtn.dataset.id;
                this.toggleTestResult(id);
                return;
            }

            // 삭제 버튼
            const deleteBtn = e.target.closest('.btn-delete');
            if (deleteBtn) {
                const id = deleteBtn.dataset.id;
                if (confirm('이 항목을 삭제하시겠습니까?')) {
                    this.deleteSample(id);
                }
                return;
            }

            // 수정 버튼
            const editBtn = e.target.closest('.btn-edit');
            if (editBtn) {
                const id = editBtn.dataset.id;
                this.editSample(id);
                return;
            }

            // 분석결과 버튼
            const analysisBtn = e.target.closest('.btn-analysis-open');
            if (analysisBtn) {
                this.openCompostAnalysisModal(analysisBtn.dataset.id);
                return;
            }
        });

        // 부숙도 드롭다운 변경 이벤트
        this.tableBody.addEventListener('change', (e) => {
            const maturitySelect = e.target.closest('.maturity-select');
            if (maturitySelect) {
                const id = maturitySelect.dataset.id;
                this.updateMaturity(id, maturitySelect.value);
                return;
            }
        });

        // 함수율 입력 변경 이벤트 (blur 시 저장)
        this.tableBody.addEventListener('blur', (e) => {
            const moistureInput = e.target.closest('.moisture-input');
            if (moistureInput) {
                const id = moistureInput.dataset.id;
                this.updateMoisture(id, moistureInput.value);
                return;
            }
        }, true); // capture phase for blur event

        // 함수율 Enter 키 입력 시 저장
        this.tableBody.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const moistureInput = e.target.closest('.moisture-input');
                if (moistureInput) {
                    const id = moistureInput.dataset.id;
                    this.updateMoisture(id, moistureInput.value);
                    moistureInput.blur();
                    return;
                }
            }
        });
    }

    // ========================================
    // 접수번호 자동 생성
    // ========================================

    generateNextReceptionNumber() {
        let maxNumber = 0;

        this.sampleLogs.forEach(log => {
            if (log.receptionNumber) {
                const num = parseInt(log.receptionNumber, 10);
                if (!isNaN(num) && num > maxNumber) {
                    maxNumber = num;
                }
            }
        });

        const nextNumber = maxNumber + 1;
        return String(nextNumber);
    }

    // ========================================
    // 완료 토글
    // ========================================

    toggleComplete(id) {
        const log = this.sampleLogs.find(l => String(l.id) === id);
        if (log) {
            log.isComplete = !log.isComplete;
            log.updatedAt = new Date().toISOString();
            this.saveLogs();
            this.filterAndRenderLogs();

            // SLS-1-203: 판정 없이 완료 표시하면 알린다. **막지는 않는다** —
            //   접수 완료와 판정은 순서가 정해져 있지 않아 판정 전 완료가 정상 업무일
            //   수 있다. confirm()이면 매번 클릭을 하나 더 요구한다.
            // 참고: 퇴비의 완료 토글은 단건이다. 토양의 본필지/하위필지 그룹 토글
            //   규칙(CLAUDE.md)은 여기 적용되지 않으므로 토스트가 여러 번 뜰 일이 없다.
            if (log.isComplete && !this.isJudged(log)) {
                this.showToast('판정이 아직 없습니다. 완료로 표시했습니다.', 'warning');
            }
        }
    }

    // ========================================
    // 판정 결과 토글 (미판정 -> 적합 -> 부적합 -> 미판정)
    // ========================================

    /**
     * 타입 고유 필터 훅 오버라이드 (SLS-1-203).
     *
     * BaseSampleManager.js:1085의 필터 체인이 부르는 확장점이다. 판정 필터를
     * filterAndRenderLogs에 직접 넣으면 **토양과 공유하는 파일**(BaseSampleManager.js)을
     * 고치게 된다 — 이 저장소가 공유 파일 수정으로 조용한 교차 파손을 겪어온 자리다.
     *
     * 'none'은 'pass'도 'fail'도 아닌 모든 값(빈 문자열·undefined·레거시)을 뜻한다.
     * 통계 3분할과 같은 규칙이라 두 화면의 숫자가 어긋나지 않는다.
     */
    matchesTypeSpecificFilters(log) {
        const want = this.currentSearchFilter?.judgment;
        if (!want) return true;
        return this.judgmentOf(log) === want;
    }

    /**
     * 판정 정규화 — 통계·필터·완료 경고가 **같은 규칙**을 써야 화면끼리 숫자가 어긋나지 않는다.
     * 'pass'/'fail'이 아닌 모든 값(빈 문자열·undefined·레거시 문자열)은 미판정이다.
     */
    judgmentOf(log) {
        return log.testResult === 'pass' || log.testResult === 'fail' ? log.testResult : 'none';
    }

    isJudged(log) {
        return this.judgmentOf(log) !== 'none';
    }

    /** 검색 버튼 "검색 중" 표시에 판정 필터도 반영 (SLS-1-203) */
    getFilterKeys() {
        return [...super.getFilterKeys(), 'judgment'];
    }

    toggleTestResult(id) {
        const log = this.sampleLogs.find(l => String(l.id) === id);
        if (log) {
            const before = log.testResult;
            if (!log.testResult || log.testResult === '') {
                log.testResult = 'pass';
            } else if (log.testResult === 'pass') {
                log.testResult = 'fail';
            } else {
                log.testResult = '';
            }
            // 검정결과 레코드 동기화가 실패하면(quota 등) 배지만 바뀌어 두 저장소가
            // 어긋난다 — 목록은 '적합', 모달은 옛 판정. 규제 대응 기록이라 그 상태로
            // 두면 안 되므로 배지를 되돌리고 알린다.
            if (!this.syncJudgmentToResults(id, log.testResult)) {
                log.testResult = before;
                this.showToast('저장 공간이 부족해 판정을 변경하지 못했습니다.', 'error');
                return;
            }
            log.updatedAt = new Date().toISOString();
            this.saveLogs();
            this.filterAndRenderLogs();
        }
    }

    /**
     * 배지로 매긴 판정을 검정결과 레코드에도 반영한다 (SLS-1-203).
     *
     * 같은 사실(판정)을 log.testResult와 레코드의 judgment 두 곳이 들고 있는데
     * 동기화가 한 방향뿐이었다 — saveCompostAnalysis는 레코드 → log로 흘려보내지만
     * 배지 토글은 log만 고쳤다. 그래서 이 순서에서 판정이 조용히 사라졌다.
     *
     *   ① 모달에서 '미판정' 저장 → judgment:'' 레코드 생성
     *   ② 배지로 '적합' → log.testResult만 바뀜
     *   ③ 모달 재오픈 → ('' ?? 'pass')는 ''이라 미판정으로 표시
     *   ④ 다른 항목만 고쳐 저장 → 배지 판정 소실
     *
     * 레코드가 **있을 때만** 갱신한다. 없는데 만들면 검정값이 텅 빈 레코드가 생겨
     * "결과확인" 라벨이 켜지고 사용자는 입력한 적 없는 결과가 있다고 오해한다.
     */
    syncJudgmentToResults(id, judgment) {
        const all = this.loadAllCompostTestResults();
        const rec = all[String(id)];
        if (!rec || rec.judgment === judgment) return true;   // 할 일 없음 = 성공
        rec.judgment = judgment;
        rec.updatedAt = new Date().toISOString();
        // ⚠️ 반환값을 버리면 안 된다. saveAllCompostTestResults는 quota 초과 시 false를
        //    돌려준다. 무시하면 배지와 레코드가 어긋난 채 남고, 모달은 옛 판정을
        //    보여준다(existing이 여전히 truthy라 ?? 폴백도 안 걸린다).
        //    saveCompostAnalysis가 SLS-1-204 코드리뷰에서 이미 고친 것과 같은 실패 모드다.
        if (!this.saveAllCompostTestResults(all)) return false;
        this._cachedCompostResults = null;
        return true;
    }

    // BaseSampleManager의 setupTableEventDelegation()이 toggleResult를 호출하므로 alias
    toggleResult(id) {
        this.toggleTestResult(id);
    }

    // ========================================
    // 부숙도 / 함수율 업데이트
    // ========================================

    updateMaturity(id, value) {
        const logItem = this.sampleLogs.find(l => String(l.id) === id);
        if (logItem) {
            logItem.maturity = value;
            logItem.updatedAt = new Date().toISOString();
            this.saveLogs();
            this.log('부숙도 업데이트:', id, value);
        }
    }

    updateMoisture(id, value) {
        const logItem = this.sampleLogs.find(l => String(l.id) === id);
        if (logItem) {
            logItem.moisture = value;
            logItem.updatedAt = new Date().toISOString();
            this.saveLogs();
            this.log('함수율 업데이트:', id, value);
        }
    }

    // ========================================
    // 시료종류/축종 뱃지
    // ========================================

    getSampleTypeBadge(type) {
        const typeMap = {
            '가축분퇴비': { class: 'compost', icon: '🌿' },
            '가축분뇨발효액': { class: 'liquid', icon: '💧' }
        };
        const config = typeMap[type] || { class: 'other', icon: '📦' };
        return `<span class="sample-type-badge ${config.class}">${config.icon} ${escapeHTML(type || '기타')}</span>`;
    }

    getAnimalTypeBadge(type) {
        const typeMap = {
            '소': { class: 'cow', icon: '🐄' },
            '돼지': { class: 'pig', icon: '🐷' },
            '닭·오리 등': { class: 'chicken', icon: '🐔' }
        };
        const config = typeMap[type] || { class: 'other', icon: '🐾' };
        return `<span class="animal-type-badge ${config.class}">${config.icon} ${escapeHTML(type || '기타')}</span>`;
    }

    // ========================================
    // 전체 선택 / 선택 삭제
    // ========================================

    setupBulkActions() {
        if (this.selectAllCheckbox) {
            this.selectAllCheckbox.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.row-checkbox');
                checkboxes.forEach(cb => cb.checked = this.selectAllCheckbox.checked);
            });
        }

        // 성명 클릭 시 같은 이름 일괄 선택
        const tableBody = this.tableBody || document.querySelector('tbody');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const nameCell = e.target.closest('.col-name');
                if (nameCell && nameCell.dataset.name) {
                    const targetName = nameCell.dataset.name;
                    const rowCheckboxes = tableBody.querySelectorAll('.row-checkbox');
                    const targetCheckboxes = [];

                    rowCheckboxes.forEach(cb => {
                        const tr = cb.closest('tr');
                        const nc = tr?.querySelector('.col-name');
                        if (nc && nc.dataset.name === targetName) {
                            targetCheckboxes.push(cb);
                        }
                    });

                    if (targetCheckboxes.length === 0) return;
                    const allChecked = targetCheckboxes.every(cb => cb.checked);
                    targetCheckboxes.forEach(cb => { cb.checked = !allChecked; });

                    if (this.selectAllCheckbox) {
                        const allBoxes = tableBody.querySelectorAll('.row-checkbox');
                        const checkedBoxes = tableBody.querySelectorAll('.row-checkbox:checked');
                        this.selectAllCheckbox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
                        this.selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allBoxes.length;
                    }
                }
            });

            // 개별 체크박스 변경 시 전체 선택 상태 갱신
            tableBody.addEventListener('change', (e) => {
                if (e.target.classList.contains('row-checkbox')) {
                    const allBoxes = tableBody.querySelectorAll('.row-checkbox');
                    const checkedBoxes = tableBody.querySelectorAll('.row-checkbox:checked');
                    if (this.selectAllCheckbox) {
                        this.selectAllCheckbox.checked = allBoxes.length > 0 && checkedBoxes.length === allBoxes.length;
                        this.selectAllCheckbox.indeterminate = checkedBoxes.length > 0 && checkedBoxes.length < allBoxes.length;
                    }
                }
            });
        }

        const btnBulkDelete = document.getElementById('deleteSelectedBtn');
        if (btnBulkDelete) {
            btnBulkDelete.addEventListener('click', async () => {
                const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);

                if (selectedIds.length === 0) {
                    alert('삭제할 항목을 선택해주세요.');
                    return;
                }

                if (confirm(`선택한 ${selectedIds.length}건을 삭제하시겠습니까?`)) {
                    this.sampleLogs = this.sampleLogs.filter(log => !selectedIds.includes(String(log.id)));
                    this.saveLogs();
                    this.filterAndRenderLogs();
                    this.selectAllCheckbox.checked = false;

                    // Firebase에서도 삭제 (await로 완료 보장)
                    if (window.firestoreDb?.isEnabled()) {
                        try {
                            await Promise.all(selectedIds.map(id =>
                                window.firestoreDb.delete('compost', parseInt(this.selectedYear, 10), id)
                            ));
                            this.log('Firebase 일괄 삭제 완료:', selectedIds.length, '건');
                        } catch (err) {
                            (window.logger?.error || console.error)('Firebase 일괄 삭제 실패:', err);
                        }
                    }

                    this.showToast(`${selectedIds.length}건이 삭제되었습니다.`, 'success');
                }
            });
        }
    }

    // ========================================
    // 라벨 인쇄
    // ========================================

    setupLabelPrint() {
        const printLabelBtn = document.getElementById('printLabelBtn');
        if (!printLabelBtn) return;

        printLabelBtn.addEventListener('click', () => {
            const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);

            if (selectedIds.length === 0) {
                if (this.sampleLogs.length === 0) {
                    alert('인쇄할 데이터가 없습니다.');
                    return;
                }

                if (!confirm(`선택된 항목이 없습니다.\n전체 ${this.sampleLogs.length}건을 라벨 인쇄하시겠습니까?`)) {
                    return;
                }

                this.openLabelPrintWithData(this.sampleLogs);
            } else {
                const selectedLogs = this.sampleLogs.filter(log => selectedIds.includes(String(log.id)));
                this.openLabelPrintWithData(selectedLogs);
            }
        });
    }

    // openLabelPrintWithData / getLabelAddressParts(분리필드 기본) → Base 승격 (L1 Phase 3 P3-B)

    // ========================================
    // 일괄 우편발송일자 입력 (모달)
    // ========================================

    setupBulkMailDate() {
        const btnBulkMailDate = document.getElementById('btnBulkMailDate');
        const mailDateModal = document.getElementById('mailDateModal');
        const closeMailDateModal = document.getElementById('closeMailDateModal');
        const cancelMailDateBtn = document.getElementById('cancelMailDateBtn');
        const confirmMailDateBtn = document.getElementById('confirmMailDateBtn');
        const mailDateInput = document.getElementById('mailDateInput');
        const mailDateInfo = document.getElementById('mailDateInfo');

        const closeModalFn = () => {
            if (mailDateModal) mailDateModal.classList.add('hidden');
            this.pendingMailDateIds = [];
        };

        if (closeMailDateModal) closeMailDateModal.addEventListener('click', closeModalFn);
        if (cancelMailDateBtn) cancelMailDateBtn.addEventListener('click', closeModalFn);
        if (mailDateModal) {
            mailDateModal.querySelector('.modal-overlay')?.addEventListener('click', closeModalFn);
        }

        if (confirmMailDateBtn) {
            confirmMailDateBtn.addEventListener('click', () => {
                const inputDate = mailDateInput?.value;

                if (!inputDate) {
                    this.showToast('날짜를 선택해주세요.', 'warning');
                    return;
                }

                let updatedCount = 0;
                this.sampleLogs = this.sampleLogs.map(log => {
                    if (this.pendingMailDateIds.includes(String(log.id))) {
                        updatedCount++;
                        return { ...log, mailDate: inputDate, updatedAt: new Date().toISOString() };
                    }
                    return log;
                });

                this.saveLogs();
                this.filterAndRenderLogs();
                this.selectAllCheckbox.checked = false;

                closeModalFn();
                this.showToast(`${updatedCount}건의 발송일자가 입력되었습니다.`, 'success');
            });
        }

        if (btnBulkMailDate) {
            btnBulkMailDate.addEventListener('click', () => {
                const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);

                if (selectedIds.length === 0) {
                    this.showToast('발송일자를 입력할 항목을 선택해주세요.', 'warning');
                    return;
                }

                this.pendingMailDateIds = selectedIds;
                const today = new Date().toISOString().split('T')[0];
                if (mailDateInput) mailDateInput.value = today;
                if (mailDateInfo) mailDateInfo.textContent = `선택한 ${selectedIds.length}건의 우편발송일자를 입력하세요.`;
                if (mailDateModal) mailDateModal.classList.remove('hidden');
            });
        }
    }

    // ========================================
    // 통계 모달
    // ========================================

    setupStatisticsModal() {
        const statsBtn = document.getElementById('statsBtn');
        const statsModal = document.getElementById('statsModal');
        const closeStatsModal = document.getElementById('closeStatsModal');
        const closeStatsBtn2 = document.getElementById('closeStatsBtn2');

        if (statsBtn) {
            statsBtn.addEventListener('click', () => this.showStatistics());
        }
        if (closeStatsModal) {
            closeStatsModal.addEventListener('click', () => statsModal.classList.add('hidden'));
        }
        if (closeStatsBtn2) {
            closeStatsBtn2.addEventListener('click', () => statsModal.classList.add('hidden'));
        }
        if (statsModal) {
            statsModal.querySelector('.modal-overlay')?.addEventListener('click', () => statsModal.classList.add('hidden'));
        }
    }

    showStatistics() {
        const statsModal = document.getElementById('statsModal');
        const total = this.sampleLogs.length;
        const completed = this.sampleLogs.filter(l => l.isComplete).length;
        const pending = total - completed;

        document.getElementById('statTotalCount').textContent = total.toLocaleString();
        document.getElementById('statCompletedCount').textContent = completed.toLocaleString();
        document.getElementById('statPendingCount').textContent = pending.toLocaleString();

        // 뱃지 업데이트
        const completedRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
        const pendingRate = total > 0 ? ((pending / total) * 100).toFixed(1) : 0;
        const totalBadge = document.getElementById('statTotalBadge');
        const completedRateEl = document.getElementById('statCompletedRate');
        const pendingRateEl = document.getElementById('statPendingRate');
        if (totalBadge) totalBadge.textContent = `${total}건`;
        if (completedRateEl) completedRateEl.textContent = `${completedRate}%`;
        if (pendingRateEl) pendingRateEl.textContent = `${pendingRate}%`;

        // SLS-1-203: 판정 3분할. 자동 판정을 없앤 뒤(SLS-1-202) 미판정을 알아챌 수단이
        //   목록 배지 '-' 하나뿐이었다. 합은 반드시 total과 같다 — 'pass'/'fail'이
        //   아닌 값(빈 문자열·undefined·레거시)은 전부 미판정으로 센다.
        const judged = { pass: 0, fail: 0, none: 0 };
        this.sampleLogs.forEach(l => { judged[this.judgmentOf(l)]++; });
        const rate = (n) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        setText('statPassCount', judged.pass.toLocaleString());
        setText('statFailCount', judged.fail.toLocaleString());
        setText('statUnjudgedCount', judged.none.toLocaleString());
        setText('statPassRate', `${rate(judged.pass)}%`);
        setText('statFailRate', `${rate(judged.fail)}%`);
        setText('statUnjudgedRate', `${rate(judged.none)}%`);

        // 시료종류별
        const compostClassMap = {
            '가축분퇴비': { label: '🐄 가축분퇴비', class: 'compost-manure' },
            '가축분액비': { label: '💧 가축분액비', class: 'compost-liquid' }
        };
        const bySampleType = {};
        Object.entries(compostClassMap).forEach(([key, val]) => {
            bySampleType[key] = { count: 0, ...val };
        });
        this.sampleLogs.forEach(l => {
            const type = l.sampleType || '미지정';
            if (!bySampleType[type]) {
                bySampleType[type] = { count: 0, ...compostClassMap[type] || { label: type, class: 'compost-other' } };
            }
            bySampleType[type].count++;
        });
        this.renderHorizontalBarChart('statsByCompostType', bySampleType, 'compost');

        // 축종별 (모든 카테고리 미리 초기화)
        const animalClassMap = {
            '소': { label: '🐄 소', class: 'animal-cow' },
            '돼지': { label: '🐷 돼지', class: 'animal-pig' },
            '닭/오리': { label: '🐔 닭/오리', class: 'animal-chicken' }
        };
        const byAnimalType = {};
        Object.entries(animalClassMap).forEach(([key, val]) => {
            byAnimalType[key] = { count: 0, ...val };
        });
        this.sampleLogs.forEach(l => {
            let type = l.animalType || '미지정';
            if (type === '닭' || type === '오리') type = '닭/오리';
            if (!byAnimalType[type]) {
                byAnimalType[type] = { count: 0, ...animalClassMap[type] || { label: type, class: 'animal-other' } };
            }
            byAnimalType[type].count++;
        });
        this.renderHorizontalBarChart('statsByAnimalType', byAnimalType, 'animal');

        // 수령방법별 (모든 항목 미리 초기화)
        const methodMapping = {
            '우편': { label: '📮 우편', class: 'method-mail' },
            '이메일': { label: '📧 이메일', class: 'method-email' },
            '팩스': { label: '📠 팩스', class: 'method-fax' },
            '방문': { label: '🚶 방문', class: 'method-visit' }
        };
        const byReceptionMethod = {};
        Object.entries(methodMapping).forEach(([key, val]) => {
            byReceptionMethod[key] = { count: 0, ...val };
        });
        this.sampleLogs.forEach(l => {
            let method = l.receptionMethod || '';
            if (method === '직접방문') method = '방문';
            if (method && byReceptionMethod[method]) {
                byReceptionMethod[method].count++;
            }
        });
        this.renderMethodCards('statsByReceptionMethod', byReceptionMethod);

        // 월별 집계
        const byMonth = {};
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

        for (let i = 1; i <= 12; i++) {
            const monthKey = String(i).padStart(2, '0');
            byMonth[monthKey] = {
                count: 0,
                completed: 0,
                pending: 0,
                label: monthNames[i - 1],
                class: 'month'
            };
        }

        this.sampleLogs.forEach(l => {
            if (l.date) {
                const monthNum = l.date.substring(5, 7);
                if (byMonth[monthNum]) {
                    byMonth[monthNum].count++;
                    if (l.isComplete) {
                        byMonth[monthNum].completed++;
                    } else {
                        byMonth[monthNum].pending++;
                    }
                }
            }
        });

        // 분기별 집계
        const byQuarter = {
            Q1: { count: 0, completed: 0, pending: 0, label: '1분기 (1~3월)' },
            Q2: { count: 0, completed: 0, pending: 0, label: '2분기 (4~6월)' },
            Q3: { count: 0, completed: 0, pending: 0, label: '3분기 (7~9월)' },
            Q4: { count: 0, completed: 0, pending: 0, label: '4분기 (10~12월)' }
        };

        Object.entries(byMonth).forEach(([monthKey, data]) => {
            const monthNum = parseInt(monthKey, 10);
            let quarter;
            if (monthNum <= 3) quarter = 'Q1';
            else if (monthNum <= 6) quarter = 'Q2';
            else if (monthNum <= 9) quarter = 'Q3';
            else quarter = 'Q4';

            byQuarter[quarter].count += data.count;
            byQuarter[quarter].completed += data.completed;
            byQuarter[quarter].pending += data.pending;
        });

        this.renderMonthlyChart('statsByMonth', byMonth);
        this.renderQuarterlySummary('statsQuarterly', byQuarter);

        const monthRange = document.getElementById('statsMonthRange');
        if (monthRange) monthRange.textContent = `${new Date().getFullYear()}년 1월 ~ 12월`;

        statsModal.classList.remove('hidden');
    }

    renderMonthlyChart(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
        const maxCount = Math.max(...entries.map(([, v]) => v.count), 1);
        const totalCount = entries.reduce((sum, [, v]) => sum + v.count, 0);

        if (totalCount === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }

        container.innerHTML = '';
        const chart = document.createElement('div');
        chart.className = 'monthly-chart';

        const barsRow = document.createElement('div');
        barsRow.className = 'monthly-bars';

        entries.forEach(([key, value]) => {
            const heightPercent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;
            const completedPercent = value.count > 0 ? (value.completed / value.count) * 100 : 0;

            const group = document.createElement('div');
            group.className = 'monthly-bar-group';

            const barContainer = document.createElement('div');
            barContainer.className = 'monthly-bar-container';

            const stack = document.createElement('div');
            stack.className = 'monthly-bar-stack';
            stack.style.height = `${heightPercent}%`;

            const completedBar = document.createElement('div');
            completedBar.className = 'monthly-bar-completed';
            completedBar.style.height = `${completedPercent}%`;
            completedBar.title = `완료: ${value.completed}건`;

            const pendingBar = document.createElement('div');
            pendingBar.className = 'monthly-bar-pending';
            pendingBar.style.height = `${100 - completedPercent}%`;
            pendingBar.title = `미완료: ${value.pending}건`;

            stack.appendChild(completedBar);
            stack.appendChild(pendingBar);
            barContainer.appendChild(stack);

            if (value.count > 0) {
                const val = document.createElement('span');
                val.className = 'monthly-bar-value';
                val.textContent = value.count;
                barContainer.appendChild(val);
            }

            const label = document.createElement('span');
            label.className = 'monthly-bar-label';
            label.textContent = value.label;

            group.appendChild(barContainer);
            group.appendChild(label);
            barsRow.appendChild(group);
        });

        chart.appendChild(barsRow);

        const legend = document.createElement('div');
        legend.className = 'monthly-legend';
        const legendCompleted = document.createElement('span');
        legendCompleted.className = 'legend-item';
        legendCompleted.innerHTML = sanitizeHTML('<span class="legend-color completed"></span> 완료');
        const legendPending = document.createElement('span');
        legendPending.className = 'legend-item';
        legendPending.innerHTML = sanitizeHTML('<span class="legend-color pending"></span> 미완료');
        legend.appendChild(legendCompleted);
        legend.appendChild(legendPending);
        chart.appendChild(legend);

        container.appendChild(chart);
    }

    renderQuarterlySummary(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const totalCount = Object.values(data).reduce((sum, q) => sum + q.count, 0);

        container.innerHTML = '';
        const summary = document.createElement('div');
        summary.className = 'quarterly-summary';

        Object.entries(data).forEach(([key, value]) => {
            const percent = totalCount > 0 ? ((value.count / totalCount) * 100).toFixed(1) : 0;

            const item = document.createElement('div');
            item.className = 'quarterly-item';

            const label = document.createElement('div');
            label.className = 'quarterly-label';
            label.textContent = value.label;

            const stats = document.createElement('div');
            stats.className = 'quarterly-stats';
            const countSpan = document.createElement('span');
            countSpan.className = 'quarterly-count';
            countSpan.textContent = `${value.count}건`;
            const percentSpan = document.createElement('span');
            percentSpan.className = 'quarterly-percent';
            percentSpan.textContent = `(${percent}%)`;
            stats.appendChild(countSpan);
            stats.appendChild(percentSpan);

            const detail = document.createElement('div');
            detail.className = 'quarterly-detail';
            const completedSpan = document.createElement('span');
            completedSpan.className = 'quarterly-completed';
            completedSpan.textContent = `완료 ${value.completed}`;
            const pendingSpan = document.createElement('span');
            pendingSpan.className = 'quarterly-pending';
            pendingSpan.textContent = `미완료 ${value.pending}`;
            detail.appendChild(completedSpan);
            detail.appendChild(pendingSpan);

            item.appendChild(label);
            item.appendChild(stats);
            item.appendChild(detail);
            summary.appendChild(item);
        });

        container.appendChild(summary);
    }

    renderHorizontalBarChart(containerId, data, prefix) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const entries = Object.entries(data).sort((a, b) => b[1].count - a[1].count);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }

        const maxCount = Math.max(...entries.map(([, v]) => v.count));
        container.innerHTML = '';

        entries.forEach(([key, value]) => {
            const percent = maxCount > 0 ? (value.count / maxCount) * 100 : 0;

            const item = document.createElement('div');
            item.className = 'stat-bar-item';

            const label = document.createElement('span');
            label.className = 'stat-bar-label';
            label.textContent = value.label;

            const wrapper = document.createElement('div');
            wrapper.className = 'stat-bar-wrapper';

            const bar = document.createElement('div');
            bar.className = `stat-bar ${value.class}`;
            bar.style.width = `${percent}%`;
            wrapper.appendChild(bar);

            const val = document.createElement('span');
            val.className = 'stat-bar-value-outside';
            val.textContent = value.count;

            item.appendChild(label);
            item.appendChild(wrapper);
            item.appendChild(val);
            container.appendChild(item);
        });
    }

    renderMethodCards(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const entries = Object.entries(data);
        if (entries.length === 0) {
            container.innerHTML = sanitizeHTML('<div class="stats-empty">데이터가 없습니다</div>');
            return;
        }

        container.innerHTML = '';
        entries.forEach(([key, value]) => {
            const card = document.createElement('div');
            card.className = 'method-card';

            const name = document.createElement('span');
            name.className = 'method-card-name';
            name.textContent = value.label;

            const count = document.createElement('span');
            count.className = 'method-card-count';
            count.textContent = value.count;

            card.appendChild(name);
            card.appendChild(count);
            container.appendChild(card);
        });
    }

    // ========================================
    // 검색 모달
    // ========================================

    setupSearchModal() {
        const openSearchModalBtn = document.getElementById('openSearchModalBtn');
        const listSearchModal = document.getElementById('listSearchModal');
        const closeSearchModal = document.getElementById('closeSearchModal');
        const applySearchBtn = document.getElementById('applySearchBtn');
        const resetSearchBtn = document.getElementById('resetSearchBtn');
        const searchDateFromInput = document.getElementById('searchDateFromInput');
        const searchDateToInput = document.getElementById('searchDateToInput');
        const searchNameInput = document.getElementById('searchNameInput');
        const searchReceptionFromInput = document.getElementById('searchReceptionFromInput');
        const searchReceptionToInput = document.getElementById('searchReceptionToInput');
        const clearSearchDate = document.getElementById('clearSearchDate');
        const clearSearchReception = document.getElementById('clearSearchReception');
        const completedFilter = document.getElementById('completedFilter');

        // 완료 상태 필터 드롭다운
        if (completedFilter) {
            completedFilter.addEventListener('change', (e) => {
                this.currentSearchFilter.completed = e.target.value;
                this.filterAndRenderLogs();
            });
        }

        // 판정 필터 드롭다운 (SLS-1-203)
        const judgmentFilter = document.getElementById('judgmentFilter');
        if (judgmentFilter) {
            judgmentFilter.addEventListener('change', (e) => {
                this.currentSearchFilter.judgment = e.target.value;
                this.filterAndRenderLogs();
            });
        }

        if (openSearchModalBtn) {
            openSearchModalBtn.addEventListener('click', () => {
                if (searchDateFromInput) searchDateFromInput.value = this.currentSearchFilter.dateFrom;
                if (searchDateToInput) searchDateToInput.value = this.currentSearchFilter.dateTo;
                if (searchNameInput) searchNameInput.value = this.currentSearchFilter.name;
                if (searchReceptionFromInput) searchReceptionFromInput.value = this.currentSearchFilter.receptionFrom;
                if (searchReceptionToInput) searchReceptionToInput.value = this.currentSearchFilter.receptionTo;
                listSearchModal.classList.remove('hidden');
                if (searchNameInput) searchNameInput.focus();
            });
        }
        if (closeSearchModal) {
            closeSearchModal.addEventListener('click', () => listSearchModal.classList.add('hidden'));
        }
        if (listSearchModal) {
            listSearchModal.querySelector('.modal-overlay').addEventListener('click', () => listSearchModal.classList.add('hidden'));
        }
        if (clearSearchDate) {
            clearSearchDate.addEventListener('click', () => {
                if (searchDateFromInput) searchDateFromInput.value = '';
                if (searchDateToInput) searchDateToInput.value = '';
            });
        }
        if (clearSearchReception) {
            clearSearchReception.addEventListener('click', () => {
                if (searchReceptionFromInput) searchReceptionFromInput.value = '';
                if (searchReceptionToInput) searchReceptionToInput.value = '';
            });
        }
        if (resetSearchBtn) {
            resetSearchBtn.addEventListener('click', () => {
                if (searchDateFromInput) searchDateFromInput.value = '';
                if (searchDateToInput) searchDateToInput.value = '';
                if (searchNameInput) searchNameInput.value = '';
                if (searchReceptionFromInput) searchReceptionFromInput.value = '';
                if (searchReceptionToInput) searchReceptionToInput.value = '';
                if (completedFilter) completedFilter.value = 'incomplete';
                // SLS-1-203: 판정 필터도 함께 푼다. 안 하면 초기화 후에도 목록이
                //   걸러진 채 남아 사용자는 데이터가 사라졌다고 오해한다.
                const jf = document.getElementById('judgmentFilter');
                if (jf) jf.value = '';
                this.currentSearchFilter = { dateFrom: '', dateTo: '', name: '', receptionFrom: '', receptionTo: '', completed: 'incomplete', judgment: '' };
                this.filterAndRenderLogs();
                this.updateSearchButtonState();
                listSearchModal.classList.add('hidden');
            });
        }
        if (applySearchBtn) {
            applySearchBtn.addEventListener('click', () => {
                this.currentSearchFilter.dateFrom = searchDateFromInput ? searchDateFromInput.value : '';
                this.currentSearchFilter.dateTo = searchDateToInput ? searchDateToInput.value : '';
                this.currentSearchFilter.name = searchNameInput ? searchNameInput.value.toLowerCase() : '';
                this.currentSearchFilter.receptionFrom = searchReceptionFromInput ? searchReceptionFromInput.value : '';
                this.currentSearchFilter.receptionTo = searchReceptionToInput ? searchReceptionToInput.value : '';
                this.filterAndRenderLogs();
                listSearchModal.classList.add('hidden');
            });
        }

        // Enter 키로 검색
        [searchNameInput, searchReceptionFromInput, searchReceptionToInput].forEach(input => {
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && applySearchBtn) applySearchBtn.click();
                });
            }
        });
    }

    // ========================================
    // 엑셀 내보내기
    // ========================================

    setupExcelExport() {
        const exportBtn = document.getElementById('exportBtn');
        if (!exportBtn) return;

        exportBtn.addEventListener('click', () => {
            if (this.sampleLogs.length === 0) {
                alert('내보낼 데이터가 없습니다.');
                return;
            }

            // 선택된 항목이 있으면 해당 항목만 내보내기
            const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id);
            const logsToExport = selectedIds.length > 0
                ? this.sampleLogs.filter(log => selectedIds.includes(log.id))
                : this.sampleLogs;

            if (selectedIds.length > 0) {
                this.showToast(`선택한 ${logsToExport.length}건을 내보냅니다.`, 'info');
            }

            const sortedLogs = [...logsToExport].sort((a, b) => {
                const numA = parseInt(String(a.receptionNumber).replace(/\D/g, ''), 10) || 0;
                const numB = parseInt(String(b.receptionNumber).replace(/\D/g, ''), 10) || 0;
                return numA - numB;
            });
            const excelData = sortedLogs.map(log => {
                let areaDisplay = '-';
                if (log.farmArea) {
                    const unit = log.farmAreaUnit === 'pyeong' ? '평' : 'm\u00B2';
                    areaDisplay = `${log.farmArea} ${unit}`;
                }

                const applicantType = log.applicantType || '개인';
                const birthOrCorp = applicantType === '법인' ? (log.corpNumber || '-') : (log.birthDate || '-');
                const addressParts = parseAddressParts(log.addressRoad || log.address || '');
                const fullAddress = [log.addressRoad, log.addressDetail].filter(Boolean).join(' ') || '-';

                return {
                    '접수번호': log.receptionNumber || '-',
                    '접수일자': log.date || '-',
                    '법인여부': applicantType,
                    '생년월일/법인번호': birthOrCorp,
                    '농장명': log.farmName || '-',
                    '대표자': log.name || '-',
                    '연락처': log.phoneNumber || '-',
                    '우편번호': log.addressPostcode || '-',
                    '시도': addressParts.sido || '-',
                    '시군구': addressParts.sigungu || '-',
                    '읍면동': addressParts.eupmyeondong || '-',
                    '나머지주소': (addressParts.rest + (log.addressDetail ? ' ' + log.addressDetail : '')).trim() || '-',
                    '전체주소': fullAddress,
                    '농장주소': log.farmAddress || '-',
                    '농장면적': areaDisplay,
                    '시료종류': log.sampleType || '-',
                    '축종': log.animalType || '-',
                    '원료(부재료)': log.rawMaterials || '-',
                    '생산일': log.productionDate || '-',
                    '채취일': log.samplingDate || '-',
                    '시료수': log.sampleCount || '-',
                    '검사목적': log.purpose || '-',
                    '통보방법': log.receptionMethod || '-',
                    '사업자번호': log.businessNumber || '-',
                    '농가여부': log.isFarm || '-',
                    '비료관리법': log.fertilizerLawApplies || '-',
                    '비고': log.note || '-',
                    '완료여부': log.isComplete ? '완료' : '미완료',
                    '등록일시': log.createdAt ? new Date(log.createdAt).toLocaleString('ko-KR') : '-'
                };
            });

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(sanitizeExcelData(excelData));

            // ⚠️ 길이가 컬럼 수와 정확히 같아야 한다. 컬럼만 늘리고 여기를 두면
            //    뒤쪽 열의 폭이 지정되지 않아 내용이 잘려 보인다 (SLS-1-203).
            ws['!cols'] = [
                { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 15 },   // 접수번호~생년월일
                { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 8 },   // 농장명~우편번호
                { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 25 },  // 시도~나머지주소
                { wch: 40 }, { wch: 30 }, { wch: 12 }, { wch: 12 },  // 전체주소~시료종류
                { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },  // 축종~채취일
                { wch: 8 }, { wch: 25 }, { wch: 10 },                // 시료수~통보방법
                { wch: 15 }, { wch: 10 }, { wch: 12 },               // 사업자번호~비료관리법
                { wch: 20 }, { wch: 8 }, { wch: 20 }                 // 비고~등록일시
            ];

            XLSX.utils.book_append_sheet(wb, ws, '퇴액비 접수목록');

            const fileName = `퇴액비_접수목록_${new Date().toISOString().split('T')[0]}.xlsx`;

            if (window.isElectron) {
                const xlsxData = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
                this.FileAPI.saveExcel(xlsxData, fileName).then(saved => {
                    if (saved) {
                        this.showToast('엑셀 파일로 내보내기 완료', 'success');
                    }
                });
            } else {
                XLSX.writeFile(wb, fileName);
                this.showToast('엑셀 파일로 내보내기 완료', 'success');
            }
        });
    }

    // ========================================
    // JSON 저장/불러오기
    // ========================================

    setupJSONHandlers() {
        const jsonHandlerOptions = {
            getData: () => this.sampleLogs,
            setData: (data) => { this.sampleLogs = data; },
            saveData: () => this.saveLogs(),
            renderData: () => this.filterAndRenderLogs(),
            showToast: window.showToast
        };

        SampleUtils.setupJSONSaveHandler({
            buttonElement: document.getElementById('saveJsonBtn'),
            sampleType: SAMPLE_TYPE,
            getData: () => this.sampleLogs,
            FileAPI: this.FileAPI,
            filePrefix: 'compost-samples',
            showToast: window.showToast
        });

        SampleUtils.setupJSONLoadHandler({
            inputElement: document.getElementById('loadJsonInput'),
            ...jsonHandlerOptions
        });

        SampleUtils.setupElectronLoadHandler({
            buttonElement: document.getElementById('loadFileBtn'),
            FileAPI: this.FileAPI,
            ...jsonHandlerOptions
        });
    }

    // ========================================
    // 자동 저장 설정
    // ========================================

    setupAutoSaveHandlers() {
        const autoSaveToFile = async () => {
            return await SampleUtils.performAutoSave({
                FileAPI: this.FileAPI,
                moduleKey: 'compost',
                data: this.sampleLogs,
                webFileHandle: this.autoSaveFileHandle,
                log: (...args) => this.log(...args)
            });
        };

        window.triggerCompostAutoSave = autoSaveToFile;

        SampleUtils.setupAutoSaveFolderButton({
            moduleKey: 'compost',
            FileAPI: this.FileAPI,
            selectedYear: this.selectedYear,
            getWebFileHandle: () => this.autoSaveFileHandle,
            setWebFileHandle: (handle) => { this.autoSaveFileHandle = handle; },
            autoSaveCallback: autoSaveToFile,
            showToast: window.showToast
        });

        SampleUtils.setupAutoSaveToggle({
            moduleKey: 'compost',
            FileAPI: this.FileAPI,
            getWebFileHandle: () => this.autoSaveFileHandle,
            setWebFileHandle: (handle) => { this.autoSaveFileHandle = handle; },
            autoSaveCallback: autoSaveToFile,
            showToast: window.showToast,
            log: (...args) => this.log(...args)
        });
    }

    // ========================================
    // 전체 보기/기본 보기 토글
    // ========================================

    setupColumnToggle() {
        const viewToggleBtn = document.getElementById('toggleColumnsBtn');
        const logTable = document.querySelector('.data-table');

        if (viewToggleBtn && logTable) {
            viewToggleBtn.addEventListener('click', () => {
                // SLS-1-278: 열이 늘고 줄면 그 뒤 일반 열이 전부 밀린다.
                // 바꾸기 전에 기준을 잡아 두고 바꾼 뒤에 되돌린다.
                const restoreColumnAnchor = window.captureColumnAnchor?.(logTable);

                this.isFullView = !this.isFullView;

                const toggleText = viewToggleBtn.querySelector('.toggle-text');
                const toggleIcon = viewToggleBtn.querySelector('.toggle-icon');

                if (this.isFullView) {
                    logTable.classList.add('full-view');
                    if (toggleText) toggleText.textContent = '기본 보기';
                    if (toggleIcon) toggleIcon.textContent = '👁️‍🗨️';
                    viewToggleBtn.classList.add('active');
                } else {
                    logTable.classList.remove('full-view');
                    if (toggleText) toggleText.textContent = '전체 보기';
                    if (toggleIcon) toggleIcon.textContent = '👁️';
                    viewToggleBtn.classList.remove('active');
                }
                // 🚨 순서가 중요하다 — 보던 열을 먼저 제자리로, 고정 좌표는 그 뒤에.
                //    반대로 하면 보정 전 위치에서 재 그 값이 굳는다 (SLS-1-275).
                restoreColumnAnchor?.();

                // SLS-1-264: 열이 늘고 준다. 이 토글은 목록을 다시 그리지 않으므로
                // 여기서 직접 불러야 고정 좌표가 따라간다.
                window.scheduleStickyColumns?.(logTable);
            });
        }
    }

    // ========================================
    // 농장주소 자동완성
    // ========================================

    bindFarmAddressAutocomplete() {
        const farmAddressInput = document.getElementById('farmAddressFull');
        const autocompleteList = document.getElementById('farmAddressAutocomplete');
        window.AddressAutocomplete.bind(farmAddressInput, autocompleteList, {
            regionKeys: ['bonghwa', 'yeongju', 'uljin'],
        });
        // 외부 클릭 시 목록 숨기기 (compost 전용 wrapper 클래스)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.lot-address-autocomplete-wrapper')) {
                autocompleteList?.classList.remove('show');
            }
        });
    }

    // ========================================
    // 엑셀 가져오기 (ExcelImportManager)
    // ========================================

    setupExcelImport() {
        const excelImporter = new ExcelImportManager({
            appFields: [
                { key: 'receptionNumber', label: '접수번호' },
                { key: 'date', label: '접수일자' },
                { key: 'farmName', label: '농장명' },
                { key: 'name', label: '대표자' },
                { key: 'phoneNumber', label: '전화번호' },
                { key: 'address', label: '주소' },
                { key: 'farmAddress', label: '농장주소' },
                { key: 'sampleType', label: '시료종류' },
                { key: 'animalType', label: '축종' },
                { key: 'rawMaterials', label: '원료(부재료)' },
                { key: 'productionDate', label: '생산일' },
                { key: 'purpose', label: '검사목적' },
                { key: 'receptionMethod', label: '통보방법' },
                { key: 'note', label: '비고' }
            ],
            autoMapRules: {
                '접수번호': 'receptionNumber', '번호': 'receptionNumber', 'no': 'receptionNumber',
                '접수일자': 'date', '날짜': 'date', '일자': 'date',
                '농장명': 'farmName', '상호': 'farmName', '농장': 'farmName',
                '대표자': 'name', '성명': 'name', '이름': 'name', '의뢰인': 'name',
                '전화번호': 'phoneNumber', '연락처': 'phoneNumber', '전화': 'phoneNumber',
                '주소': 'address', '의뢰인주소': 'address',
                '농장주소': 'farmAddress', '농장소재지': 'farmAddress',
                '시료종류': 'sampleType', '시료': 'sampleType', '퇴비종류': 'sampleType',
                '축종': 'animalType', '가축': 'animalType',
                '원료': 'rawMaterials', '부재료': 'rawMaterials', '원료(부재료)': 'rawMaterials',
                // SLS-1-200: 채취일자(양식 T열)와 생산일자(U열)는 별도 항목이다.
                // '채취일'이 productionDate를 가리키면 두 열이 뒤바뀐다.
                '생산일': 'productionDate', '생산일자': 'productionDate',
                '채취일': 'samplingDate', '채취일자': 'samplingDate',
                '면적': 'farmArea', '농장면적': 'farmArea',
                '검사목적': 'purpose', '목적': 'purpose', '용도': 'purpose',
                '통보방법': 'receptionMethod', '수령방법': 'receptionMethod',
                '비고': 'note', '메모': 'note'
            },
            templateConfig: {
                headers: ['접수번호', '농장명', '대표자', '시료종류', '축종', '원료(부재료)', '생산일', '검사목적', '비고'],
                sampleRow: ['1', '봉화농장', '홍길동', '가축분퇴비', '소', '톱밥, 왕겨', '2026-01-15', '비료공정규격', ''],
                colWidths: [
                    { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 14 },
                    { wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 20 }
                ],
                sheetName: '퇴액비시료',
                fileName: '퇴액비_가져오기_서식'
            },
            previewColumns: [
                { key: 'receptionNumber', label: '접수번호' },
                { key: 'date', label: '접수일자' },
                { key: 'farmName', label: '농장명' },
                { key: 'name', label: '대표자' },
                { key: 'sampleType', label: '시료종류' },
                { key: 'animalType', label: '축종' },
                { key: 'rawMaterials', label: '원료' },
                { key: 'note', label: '비고' }
            ],
            getCommonData: () => ({
                date: document.getElementById('importDate').value || new Date().toISOString().slice(0, 10),
                name: document.getElementById('importName').value.trim(),
                phone: document.getElementById('importPhone').value.trim(),
                address: document.getElementById('importAddress').value.trim(),
                method: document.getElementById('importMethod').value,
                purpose: document.getElementById('importPurpose').value.trim(),
                now: new Date().toISOString()
            }),
            buildRecord: (getVal, parseExcelDate, common, rowIdx) => {
                const receptionNumber = getVal('receptionNumber') || '';
                const dateVal = getVal('date');
                const date = parseExcelDate(dateVal) || common.date;
                const farmName = getVal('farmName') || '';
                const name = getVal('name') || common.name;
                const phoneNumber = getVal('phoneNumber') || common.phone;
                const address = getVal('address') || common.address;
                const farmAddress = getVal('farmAddress') || '';
                const sampleType = getVal('sampleType') || '가축분퇴비';
                const animalType = getVal('animalType') || '';
                const rawMaterials = getVal('rawMaterials') || '';
                const productionDateVal = getVal('productionDate');
                const productionDate = parseExcelDate(productionDateVal) || '';
                const purpose = getVal('purpose') || common.purpose;
                const receptionMethod = getVal('receptionMethod') || common.method;
                const note = getVal('note') || '';
                // SLS-1-200: 흙토람 양식이 요구하는 항목
                const farmArea = this.parseFormattedNumber(getVal('farmArea') || '') || 0;
                const samplingDate = parseExcelDate(getVal('samplingDate')) || '';

                return {
                    id: SampleUtils.generateUUID() + '_' + rowIdx,
                    receptionNumber,
                    date,
                    applicantType: '개인',
                    birthDate: '',
                    corpNumber: '',
                    farmName,
                    name,
                    phoneNumber,
                    address,
                    addressPostcode: '',
                    addressRoad: address,
                    addressDetail: '',
                    farmAddress,
                    // 0 고정이면 흙토람 내보내기에서 면적이 무조건 공란이 되고
                    //   (양식상 가축분퇴비 필수), 부숙도 합격선도 조용히 완화된다.
                    farmArea,
                    farmAreaUnit: 'm2',
                    samplingDate,
                    sampleType,
                    animalType,
                    productionDate,
                    sampleCount: '1',
                    rawMaterials,
                    purpose,
                    receptionMethod,
                    note,
                    isComplete: false,
                    createdAt: common.now,
                    updatedAt: common.now
                };
            },
            skipRowCheck: (record, rowIdx, raw) => {
                // ⚠️ `record`가 아니라 `raw`를 본다 (SLS-1-273).
                //    record는 buildRecord가 손댄 뒤라 sampleType은 늘 '가축분퇴비'이고,
                //    name은 1단계 공통 대표자로 메워진다. 그 값으로 "비었는지"를 보면
                //    **어떤 입력으로도 참이 되지 않아** 이 검사가 통째로 죽어 있었다.
                //    비고 한 칸만 적은 행이 기본값만 걸친 레코드로 등록됐다.
                if (!raw('farmName') && !raw('name') && !raw('sampleType')) {
                    return `행 ${rowIdx + 2}: 농장명, 대표자, 시료종류가 모두 비어 있어 건너뜁니다.`;
                }
                return null;
            },
            getExistingLogs: () => this.sampleLogs,
            onImportComplete: (records) => {
                records.forEach(logEntry => this.sampleLogs.push(logEntry));
                this.sampleLogs.sort((a, b) => {
                    const numA = parseInt(a.receptionNumber, 10) || 0;
                    const numB = parseInt(b.receptionNumber, 10) || 0;
                    if (numA !== numB) return numA - numB;
                    return (a.receptionNumber || '').localeCompare(b.receptionNumber || '');
                });
                this.saveLogs();
                this.filterAndRenderLogs();
            }
        });
        excelImporter.init();

        // 분석결과 모달 초기화
        this.initCompostAnalysisModal();

        // 검정결과 조회 버튼
        const compostAnalysisViewBtn = document.getElementById('compostAnalysisViewBtn');
        if (compostAnalysisViewBtn) compostAnalysisViewBtn.addEventListener('click', () => {
            const selectedIds = Array.from(document.querySelectorAll('.row-checkbox:checked')).map(cb => cb.dataset.id).filter(Boolean);
            // SLS-1-205: 라벨 인쇄·흙토람과 동일한 "setItem → 이동" 패턴 — quota 상태에서
            // throw하면 버튼이 아무 반응 없이 죽는다(SLS-1-198이 고친 양식). 실패를 알리고 중단한다.
            try {
                localStorage.setItem('compostAnalysis_year', this.selectedYear);
                localStorage.setItem('compostAnalysis_selected_ids', JSON.stringify(selectedIds));
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    this.showToast('저장 공간 부족으로 검정결과 화면에 자료를 전달하지 못했습니다. 설정에서 오래된 연도의 데이터를 정리해 주세요.', 'error');
                    return;
                }
                throw e;
            }

            // SLS-1-197 E: 메서드 존재까지 본다.
            //   구버전 preload가 openCompostAnalysis를 노출하지 않으면 TypeError로
            //   **버튼이 아무 반응 없이 죽는다.** 그럴 땐 아래 웹 경로로 넘긴다.
            //
            //   ⚠️ 이 폴백은 "죽지 않게" 하는 것이지 Electron 팝업과 동등하지 않다.
            //      메인의 setWindowOpenHandler가 로컬 상대경로 새 창을 막으므로
            //      실제로는 `window.location.href`로 **현재 창이 이동**할 가능성이 크다.
            //      구버전 Electron까지 제대로 지원하려면 메인 프로세스 호환 경로가 필요하다.
            const isElectron = window.electronAPI?.isElectron === true;
            if (isElectron && typeof window.electronAPI.openCompostAnalysis === 'function') {
                window.electronAPI.openCompostAnalysis();
            } else {
                const popup = window.open('../compost-analysis/index.html', '_blank');
                if (!popup) window.location.href = '../compost-analysis/index.html';
            }
        });
    }

    // ========================================
    // 퇴·액비 분석결과 모달
    // ========================================

    /**
     * 분석 항목 정의
     * 퇴비(가축분퇴비): 함수율 70% 이하, 부숙도, 소:염분, 돼지:구리500/아연1200
     * 액비(가축분뇨발효액): 함수율 95% 이하, 부숙도, 돼지:구리70/아연170
     */
    // SLS-1-205 S1: 검정 항목 규칙은 src/shared/compost-fields.js가 단일 진실원이다.
    //   검정결과 페이지(src/compost-analysis/)가 compost-script.js를 로드하지 않으므로,
    //   여기 정의를 두면 그쪽에서 규칙을 다시 쓰게 되고 두 벌이 되는 순간 어긋난다.
    //
    // ⚠️ static 필드(= 대입)가 아니라 **정적 getter**다.
    //   `static COMPOST_FIELDS = window.CompostFields.COMPOST_FIELDS`는 모듈 평가 시점에
    //   실행되어 로드 순서에 결합된다(compost-fields.js가 아직 없으면 TypeError로 파일 전체가
    //   죽는다). getter는 호출 시점에 해석하므로 그 결합이 없다.
    static get COMPOST_FIELDS() { return window.CompostFields.COMPOST_FIELDS; }

    getFieldsForSample(sampleType, animalType) {
        return window.CompostFields.getFieldsForSample(sampleType, animalType);
    }

    initCompostAnalysisModal() {
        const modal = document.getElementById('compostAnalysisModal');
        if (!modal) return;

        const closeModal = () => { modal.classList.add('hidden'); this._caLogId = null; };
        document.getElementById('closeCompostAnalysisModal')?.addEventListener('click', closeModal);
        document.getElementById('cancelCompostAnalysisBtn')?.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);
        modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

        document.getElementById('saveCompostAnalysisBtn')?.addEventListener('click', () => this.saveCompostAnalysis());
    }

    openCompostAnalysisModal(logId) {
        const log = this.sampleLogs.find(l => String(l.id) === String(logId));
        if (!log) return;

        const modal = document.getElementById('compostAnalysisModal');
        if (!modal) return;

        this._caLogId = logId;

        // 시료 정보
        document.getElementById('caReceptionNumber').textContent = log.receptionNumber || '-';
        document.getElementById('caDate').textContent = log.date || '-';
        document.getElementById('caName').textContent = log.name || '-';
        document.getElementById('caSampleType').textContent = log.sampleType || log.subCategory || '-';
        document.getElementById('caPurpose').textContent = log.purpose || '-';

        const animalEl = document.getElementById('caAnimalType');
        const animalType = log.animalType || '-';
        animalEl.textContent = animalType;

        // 면적 기반 부숙도 기준 동적 설정
        const sampleType = log.sampleType || '가축분퇴비';
        const areaSqm = this.getAreaInSqm(log.farmArea, log.farmAreaUnit);
        const maturityStandard = window.CompostFields.maturityStandardFor(areaSqm);

        // 시료종류+축종별 분석 항목 렌더
        const fields = this.getFieldsForSample(sampleType, animalType);
        // 부숙도 기준을 면적에 따라 동적 변경
        const adjustedFields = fields.map(f => {
            if (f.key === 'maturity') return { ...f, standard: `${maturityStandard} (${areaSqm > 0 ? areaSqm.toLocaleString() + '㎡' : '면적미입력'})` };
            return f;
        });
        this._caAreaSqm = areaSqm;
        this.renderCompostFields(adjustedFields);

        // 기존 결과 로드
        const existing = this.loadCompostTestResult(logId);
        if (existing) {
            document.getElementById('caTestDate').value = existing.testDate || '';
            for (const field of fields) {
                const input = document.getElementById(`ca_${field.key}`);
                if (input) input.value = existing[field.key] || '';
            }
        } else {
            document.getElementById('caTestDate').value = '';
            // 기존 인라인 함수율/부숙도 값 가져오기
            for (const field of fields) {
                const input = document.getElementById(`ca_${field.key}`);
                if (input) {
                    if (field.key === 'moisture') input.value = log.moisture || '';
                    else if (field.key === 'maturity') input.value = log.maturity || '';
                    else input.value = '';
                }
            }
        }

        // SLS-1-203: 판정 시드는 분기 밖에서 한 번 정한다.
        //   예전에는 검정결과 레코드가 있을 때만 시드하고 없으면 무조건 미판정으로
        //   초기화했다. 목록 배지 토글로 판정한 시료는 log.testResult에만 값이 있어
        //   **모달이 미판정으로 보이고, 저장하면 판정이 조용히 덮였다.**
        //
        //   ?? 를 쓴다 — existing.judgment가 빈 문자열이면 "명시적 미판정"이라는
        //   의사표시이므로 log.testResult로 덮으면 안 된다(|| 면 그 구분이 사라진다).
        //   레코드가 아예 없을 때만 배지 값으로 떨어진다.
        const judgment = (existing?.judgment ?? log.testResult) || '';
        const radio = document.querySelector(`input[name="caJudgment"][value="${judgment}"]`)
            || document.querySelector('input[name="caJudgment"][value=""]');
        if (radio) radio.checked = true;

        modal.classList.remove('hidden');
        setTimeout(() => {
            const firstInput = modal.querySelector('.ca-result-input, .ca-result-select');
            if (firstInput) firstInput.focus();
        }, 100);
    }

    renderCompostFields(fields) {
        const tbody = document.getElementById('caFieldsBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        fields.forEach(field => {
            const tr = document.createElement('tr');

            const tdName = document.createElement('td');
            tdName.className = 'ca-col-name';
            tdName.textContent = field.label;
            tr.appendChild(tdName);

            const tdUnit = document.createElement('td');
            tdUnit.className = 'ca-col-unit';
            tdUnit.textContent = field.unit || '-';
            tr.appendChild(tdUnit);

            // 기준값
            const tdStandard = document.createElement('td');
            tdStandard.className = 'ca-col-standard';
            tdStandard.textContent = field.standard || '-';
            tr.appendChild(tdStandard);

            const tdValue = document.createElement('td');
            tdValue.className = 'ca-col-value';

            const tdStatus = document.createElement('td');
            tdStatus.className = 'ca-col-status';
            tdStatus.id = `ca_status_${field.key}`;

            if (field.type === 'select') {
                const select = document.createElement('select');
                select.className = 'ca-result-select';
                select.id = `ca_${field.key}`;
                (field.options || []).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt || '선택';
                    select.appendChild(option);
                });
                // 부숙도 변경 시 상태 업데이트
                select.addEventListener('change', () => {
                    this.checkCompostFieldStatus(field, select.value, tdStatus);
                });
                tdValue.appendChild(select);
            } else {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'ca-result-input';
                input.id = `ca_${field.key}`;
                input.placeholder = field.unit || '-';
                input.autocomplete = 'off';
                // 입력 시 기준 비교
                input.addEventListener('input', () => {
                    this.checkCompostFieldStatus(field, input.value, tdStatus);
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const nextRow = tr.nextElementSibling;
                        if (nextRow) {
                            const nextInput = nextRow.querySelector('.ca-result-input, .ca-result-select');
                            if (nextInput) nextInput.focus();
                        }
                    }
                });
                tdValue.appendChild(input);
            }
            tr.appendChild(tdValue);
            tr.appendChild(tdStatus);

            tbody.appendChild(tr);
        });
    }

    /** 부숙도 순서 (높을수록 잘 부숙됨) — compost-fields.js 위임 */
    static get MATURITY_ORDER() { return window.CompostFields.MATURITY_ORDER; }

    /**
     * 면적을 ㎡로 환산
     * @param {string|number} area - 면적 값
     * @param {string} unit - 'pyeong' 또는 'sqm'
     * @returns {number} ㎡ 값
     */
    getAreaInSqm(area, unit) {
        return window.CompostFields.getAreaInSqm(area, unit);
    }

    checkCompostFieldStatus(field, value, statusEl) {
        if (!value || !statusEl) {
            if (statusEl) statusEl.innerHTML = '';
            return;
        }

        // SLS-1-200: 기준이 없는 항목은 상태 칸을 비운다.
        //   아래 분기가 maturity와 field.standard만 다루므로, standard가 없으면
        //   두 분기를 다 건너뛰고 isOk가 초기값 true로 남아 **무조건 초록 ✓**가 찍힌다.
        //   질소·인산·칼리는 법정 기준값이 없어 그대로 두면 "적합"으로 오보된다.
        if (field.key !== 'maturity' && !field.standard) {
            statusEl.innerHTML = '';
            return;
        }

        let isOk = true;

        if (field.key === 'maturity') {
            // ⚠️ 숫자를 쓰지 않는다. 등급이 하나 늘면 순번이 전부 밀려
            //    "부숙완료 이상"이 조용히 한 단계 아래를 통과시킨다(SLS-1-207).
            //    요구 등급은 표기(maturityStandardFor)와 같은 함수에서 나온다.
            const F = window.CompostFields;
            const order = CompostSampleManager.MATURITY_ORDER[F.normalizeMaturity(value)];
            const requiredLevel = CompostSampleManager
                .MATURITY_ORDER[F.requiredMaturityFor(this._caAreaSqm || 0)];
            isOk = order !== undefined && order >= requiredLevel;
        } else if (field.standard) {
            const num = parseFloat(value.replace(/,/g, ''));
            if (isNaN(num)) { statusEl.innerHTML = ''; return; }

            const cleanStd = field.standard.replace(/,/g, '');
            const maxMatch = cleanStd.match(/^([\d.]+)\s*이하$/);
            if (maxMatch) {
                isOk = num <= parseFloat(maxMatch[1]);
            }
        }

        statusEl.textContent = '';
        const span = document.createElement('span');
        span.style.color = isOk ? '#16a34a' : '#dc2626';
        span.textContent = isOk ? '✓' : '✕';
        statusEl.appendChild(span);
    }

    saveCompostAnalysis() {
        const logId = this._caLogId;
        if (!logId) return;

        const log = this.sampleLogs.find(l => String(l.id) === String(logId));
        if (!log) return;

        const fields = this.getFieldsForSample(log.sampleType || '가축분퇴비', log.animalType || '');
        const allResults = this.loadAllCompostTestResults();

        const result = {
            id: logId,
            testDate: document.getElementById('caTestDate')?.value || '',
            judgment: document.querySelector('input[name="caJudgment"]:checked')?.value || '',
            animalType: log.animalType || '',
            updatedAt: new Date().toISOString()
        };

        for (const field of fields) {
            const input = document.getElementById(`ca_${field.key}`);
            if (input) result[field.key] = input.value.trim();
        }

        // SLS-1-202: 판정은 검사자가 직접 한다. 이전에는 judgment가 비어 있으면
        // autoJudgeCompost 결과로 채웠으나, 사용자가 '미판정'을 고른 것도 의사표시이므로
        // 앱이 값을 덮어쓰지 않는다(빈 값을 그대로 저장하는 SLS-1-196 계약과도 일치).
        // 항목별 기준 초과 표시(checkCompostFieldStatus)는 참고용으로 유지된다.

        allResults[logId] = result;
        const stored = this.saveAllCompostTestResults(allResults);

        // 접수 데이터에 함수율/부숙도 동기화
        // SLS-1-196: 빈 값도 그대로 반영한다(judgment와 대칭).
        //   `if (result.moisture)` 방식이면 사용자가 함수율을 지워도 화면에는 옛 값이 남고
        //   검정결과 저장소에만 ''가 들어가, 다음 로드에서 sync가 정정하며 불필요한
        //   전건 batchSave가 1회 발동한다.
        log.moisture = result.moisture ?? '';
        log.maturity = result.maturity ?? '';
        log.testResult = result.judgment || '';
        this.saveLogs();

        document.getElementById('compostAnalysisModal')?.classList.add('hidden');
        this._caLogId = null;
        this.filterAndRenderLogs();

        // SLS-1-204 코드리뷰 MAJOR-1: 저장 실패(quota 등)에 성공 토스트를 띄우면 안 된다.
        //   함수율·부숙도·판정 3개는 log에 실려 saveLogs()의 SLS-1-198 경로(클라우드·자동저장)로
        //   살아남지만, 검정결과 저장소에만 있는 검사일자·구리·아연·염분은 어디에도 남지 않는다.
        //   검정결과는 Firestore 동기화가 없어(SLS-1-204) 구제 경로가 localStorage뿐이다.
        if (stored) {
            this.showToast('분석결과가 저장되었습니다.', 'success');
        } else {
            this.showToast(
                '저장 공간이 부족해 검정결과가 저장되지 않았습니다. 즉시 JSON 저장으로 백업해 주세요.',
                'error'
            );
        }
    }

    // === 데이터 저장/로드 ===

    loadCompostTestResult(logId) {
        if (!this._cachedCompostResults) {
            this._cachedCompostResults = this.loadAllCompostTestResults();
        }
        return this._cachedCompostResults[logId] || null;
    }

    // SLS-1-204: 저장소 접근은 window.CompostResultsStore 하나로 모은다.
    //   검정결과 페이지(src/compost-analysis/, P1~P3에서 신설 예정)가 별도 창에서 같은
    //   데이터를 읽고 쓸 것이므로, 양쪽이 각자 localStorage를 만지면 어긋나는 순간
    //   데이터가 갈라진다. 캐시(_cachedCompostResults)는 화면 상태이므로 매니저에 남긴다.

    loadAllCompostTestResults() {
        return window.CompostResultsStore.load(this.selectedYear);
    }

    /**
     * @returns {boolean} 저장 성공 여부 — 호출부가 성공/실패 안내를 분기한다.
     *   반환값을 버리면 quota 실패에도 "저장되었습니다"가 뜬다(코드리뷰 MAJOR-1).
     */
    saveAllCompostTestResults(results) {
        // 저장 실패(quota 등)에도 캐시는 갱신한다 — 화면에 보이는 값과 메모리 상태를
        // 일치시켜야 사용자가 방금 입력한 내용이 사라진 것처럼 보이지 않는다.
        this._cachedCompostResults = results;
        return window.CompostResultsStore.save(this.selectedYear, results);
    }

    // newYear는 쓰지 않는다 — base가 this.selectedYear를 이미 설정한 뒤 호출한다.
    // base 계약(onYearChange(newYear))을 지키기 위해 시그니처만 유지한다.
    onYearChange(newYear) {
        this.updateListViewTitle();
        // 캐시만 비운다 — 다음 loadCompostTestResult 호출이 새 연도 값을 읽는다.
        this._cachedCompostResults = null;
    }

    // ========================================
    // Electron 자동 저장 파일 로드
    // ========================================

    async loadAutoSaveOnInit() {
        // 로컬 모드에서만 auto-save 로드 (Firebase 모드에서는 로드 안함)
        if (window.firebaseConfig?.isEnabled()) {
            this.log('Firebase 모드: 자동 저장 로드 비활성화됨');
            return;
        }

        // 로컬 모드: auto-save 파일에서 로드
        if (!window.isElectron || !this.FileAPI?.autoSavePath || this.sampleLogs.length > 0) {
            return;
        }

        try {
            const autoSaveData = await window.loadFromAutoSaveFile();
            if (autoSaveData && autoSaveData.length > 0) {
                this.sampleLogs = autoSaveData;
                localStorage.setItem(this.getStorageKey(this.selectedYear), JSON.stringify(this.sampleLogs));
                this.filterAndRenderLogs();
                if (this.receptionNumberInput) {
                    this.receptionNumberInput.value = this.generateNextReceptionNumber();
                }
                this.log('로컬 모드: 자동 저장 파일에서 데이터 로드됨:', autoSaveData.length, '건');
            }
        } catch (error) {
            this.log('자동 저장 파일 로드 오류:', error);
        }
    }

    // ========================================
    // 유틸리티 메서드
    // ========================================

    formatNumberWithCommas(value) {
        const num = String(value).replace(/[^\d]/g, '');
        if (!num) return '';
        return parseInt(num, 10).toLocaleString('ko-KR');
    }

    parseFormattedNumber(value) {
        return value.replace(/,/g, '');
    }

    updateListViewTitle() {
        const listViewTitle = document.getElementById('listViewTitle');
        if (listViewTitle) {
            listViewTitle.textContent = '퇴·액비 접수 목록';
        }
    }
}

// 전역 노출 (단위 테스트 및 디버깅용 — 인스턴스화는 DOMContentLoaded에서만 수행)
window.CompostSampleManager = CompostSampleManager;

// ========================================
// 인스턴스 생성 및 초기화
// ========================================

document.addEventListener('DOMContentLoaded', async () => {
    const manager = new CompostSampleManager();
    await manager.init();
    window.compostManager = manager;
});
