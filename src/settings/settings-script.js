// Firebase 설정 저장 키 (firebase-config.js의 FIREBASE_CONFIG_KEY와 동일 값)
const SETTINGS_FIREBASE_KEY = 'firebase_config';
// 데이터 마이그레이션·전체 내보내기 대상 (SLS-1-192: 퇴비 추가)
// ⚠️ 여기에 빠진 시료 종은 백업/내보내기에서 조용히 제외된다. 사용자는 백업했다고 믿고
//    PC 교체·캐시 정리를 하므로 누락 = 데이터 유실이다. 시료 종 추가 시 반드시 함께 갱신할 것.
const SAMPLE_TYPES = [
    { key: 'soil', name: '토양', icon: '🌱', storagePrefix: 'soilSampleLogs' },
    // extraKeys: 시료 로그와 별개로 저장되는 부속 데이터. 전체 내보내기(백업)에만 포함한다.
    // Firestore 마이그레이션 경로(storageManager.migrate)는 시료 타입 기준이라 여기에 넣으면
    // 잘못된 컬렉션에 기록되므로 제외한다. 검정결과는 compost-script가 자체 동기화한다.
    { key: 'compost', name: '가축분뇨퇴비', icon: '🐄', storagePrefix: 'compostSampleLogs',
      extraKeys: ['compostTestResults'] }
];

// Electron 환경 확인
const isElectron = window.electronAPI?.isElectron === true;

// ========================================
// 인증 파일 관련 함수 (Electron 전용)
// ========================================

// 인증 파일 상태 확인 및 UI 업데이트
async function checkAuthFileStatus() {
    const statusEl = document.getElementById('authFileStatus');
    const uploadArea = document.getElementById('authFileUploadArea');
    const infoArea = document.getElementById('authFileInfo');

    if (!isElectron) {
        // 웹 환경: localStorage에서 설정 확인
        if (window.firebaseConfig?.isEnabled?.()) {
            statusEl.className = 'status-badge connected';
            statusEl.textContent = '● 연결됨';
            uploadArea.style.display = 'none';
            infoArea.style.display = 'block';
            document.getElementById('authFileProjectId').textContent = '웹 환경 - 설정 저장됨';
        } else {
            statusEl.className = 'status-badge disconnected';
            statusEl.textContent = '● 미등록';
            uploadArea.style.display = 'block';
            infoArea.style.display = 'none';
        }
        // 웹 환경에서도 인증 파일 업로드 가능하도록 섹션 표시
        document.querySelector('#authFileSection .alert-info').innerHTML = sanitizeHTML(
            '<strong>인증 파일이란?</strong><br>' +
            '클라우드 접근을 위한 인증 파일을 업로드하면 자동으로 설정됩니다.<br>' +
            '<small style="color: #64748b;">(웹 환경: 설정이 브라우저에 저장됩니다)</small>'
        );
        return;
    }

    try {
        const result = await window.electronAPI.readAuthFile();

        if (result.exists && result.content) {
            try {
                const config = JSON.parse(result.content);
                if (config.projectId) {
                    // 인증 파일 등록됨
                    statusEl.className = 'status-badge connected';
                    statusEl.textContent = '● 등록됨';
                    uploadArea.style.display = 'none';
                    infoArea.style.display = 'block';
                    document.getElementById('authFileProjectId').textContent = `프로젝트: ${config.projectId}`;
                    return;
                }
            } catch (e) {
                console.error('인증 파일 파싱 오류:', e);
            }
        }

        // 인증 파일 미등록
        statusEl.className = 'status-badge disconnected';
        statusEl.textContent = '● 미등록';
        uploadArea.style.display = 'block';
        infoArea.style.display = 'none';
    } catch (error) {
        console.error('인증 파일 확인 오류:', error);
    }
}

// 인증 파일 저장
async function saveAuthFile(content) {
    try {
        // JSON 파싱 검증
        const config = JSON.parse(content);
        if (!config.apiKey || !config.projectId) {
            alert('유효하지 않은 인증 파일입니다.\nAPI Key와 Project ID가 필요합니다.');
            return false;
        }

        if (!isElectron) {
            // 웹 환경: localStorage에 저장
            if (window.firebaseConfig?.saveConfig) {
                window.firebaseConfig.saveConfig(config);
            }

            // Firebase 재초기화
            if (window.firebaseConfig?.reinitialize) {
                const initResult = await window.firebaseConfig.reinitialize();
                if (initResult) {
                    alert('인증 파일이 적용되고 클라우드가 연결되었습니다.\n프로젝트: ' + config.projectId);
                } else {
                    alert('인증 파일이 저장되었지만 클라우드 연결에 실패했습니다.\n페이지를 새로고침해주세요.');
                }
            } else {
                alert('인증 파일이 저장되었습니다.\n페이지를 새로고침하면 적용됩니다.');
            }
            await checkAuthFileStatus();
            updateConnectionStatus();
            return true;
        }

        // Electron 환경: 파일 시스템에 저장
        const result = await window.electronAPI.saveAuthFile(content);
        if (result.success) {
            // Firebase 재초기화 (새 인증 파일 적용)
            if (window.firebaseConfig?.reinitialize) {
                const initResult = await window.firebaseConfig.reinitialize();
                if (initResult) {
                    alert('인증 파일이 등록되고 클라우드가 연결되었습니다.\n프로젝트: ' + config.projectId);
                } else {
                    alert('인증 파일은 등록되었지만 클라우드 연결에 실패했습니다.\n앱을 재시작해주세요.');
                }
            } else {
                alert('인증 파일이 등록되었습니다.\n앱을 재시작하면 적용됩니다.');
            }
            await checkAuthFileStatus();
            updateConnectionStatus();
            return true;
        } else {
            alert('인증 파일 저장 실패: ' + (result.error || '알 수 없는 오류'));
            return false;
        }
    } catch (error) {
        alert('인증 파일 형식이 올바르지 않습니다.\nJSON 형식의 파일이 필요합니다.');
        return false;
    }
}

// 인증 파일 삭제
async function deleteAuthFile() {
    if (!confirm('인증 파일을 삭제하시겠습니까?\n클라우드 연결이 해제됩니다.')) {
        return;
    }

    if (!isElectron) {
        // 웹 환경: localStorage에서 삭제
        if (window.firebaseConfig?.resetConfig) {
            window.firebaseConfig.resetConfig();
        }
        alert('클라우드 설정이 삭제되었습니다.');
        await checkAuthFileStatus();
        updateConnectionStatus();
        return;
    }

    try {
        const result = await window.electronAPI.deleteAuthFile();
        if (result.success) {
            // Firebase 설정도 초기화
            if (window.firebaseConfig?.resetConfig) {
                window.firebaseConfig.resetConfig();
            }
            alert('인증 파일이 삭제되었습니다.');
            await checkAuthFileStatus();
            updateConnectionStatus();
        } else {
            alert('인증 파일 삭제 실패: ' + (result.error || '알 수 없는 오류'));
        }
    } catch (error) {
        alert('인증 파일 삭제 중 오류 발생: ' + error.message);
    }
}

// 파일 선택 버튼 클릭 (Electron 네이티브 다이얼로그 사용)
document.getElementById('selectAuthFileBtn')?.addEventListener('click', async () => {
    if (isElectron && window.electronAPI?.selectAuthFile) {
        // Electron 네이티브 파일 선택 다이얼로그
        try {
            const result = await window.electronAPI.selectAuthFile();
            if (result.canceled) {
                return;
            }
            if (result.success) {
                // Firebase 재초기화 (새 인증 파일 적용)
                if (window.firebaseConfig?.reinitialize) {
                    const initResult = await window.firebaseConfig.reinitialize();
                    if (initResult) {
                        alert('인증 파일이 등록되고 클라우드가 연결되었습니다.\n프로젝트: ' + result.projectId);
                    } else {
                        alert('인증 파일은 등록되었지만 클라우드 연결에 실패했습니다.\n앱을 재시작해주세요.');
                    }
                } else {
                    alert('인증 파일이 등록되었습니다.\n앱을 재시작하면 적용됩니다.\n프로젝트: ' + result.projectId);
                }
                await checkAuthFileStatus();
                updateConnectionStatus();
            } else {
                alert('인증 파일 등록 실패: ' + (result.error || '알 수 없는 오류'));
            }
        } catch (error) {
            alert('파일 선택 중 오류 발생: ' + error.message);
        }
    } else {
        // 웹 환경 폴백
        document.getElementById('authFileInput').click();
    }
});

// 파일 선택 처리 (웹 환경용)
document.getElementById('authFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        await saveAuthFile(event.target.result);
    };
    reader.readAsText(file);

    // 입력 초기화
    e.target.value = '';
});

// 인증 파일 삭제 버튼
document.getElementById('deleteAuthFileBtn')?.addEventListener('click', deleteAuthFile);

// 드래그 앤 드롭 지원
const uploadArea = document.getElementById('authFileUploadArea');
if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.querySelector('div').style.borderColor = '#3b82f6';
        uploadArea.querySelector('div').style.background = '#eff6ff';
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.querySelector('div').style.borderColor = '#cbd5e1';
        uploadArea.querySelector('div').style.background = '#f8fafc';
    });

    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.querySelector('div').style.borderColor = '#cbd5e1';
        uploadArea.querySelector('div').style.background = '#f8fafc';

        const file = e.dataTransfer.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            await saveAuthFile(event.target.result);
        };
        reader.readAsText(file);
    });
}

// 수동 설정 토글
function toggleManualSettings() {
    const content = document.getElementById('manualSettingsContent');
    const toggle = document.getElementById('manualSettingsToggle');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▲ 접기';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▼ 펼치기';
    }
}

// 수동 설정 토글 버튼 이벤트 리스너 (인라인 onclick 대체)
document.getElementById('manual-settings-toggle')?.addEventListener('click', toggleManualSettings);

// ========================================
// 기존 Firebase 설정 관련 함수
// ========================================

// 저장된 설정 로드
function loadSavedConfig() {
    const saved = localStorage.getItem(SETTINGS_FIREBASE_KEY);
    if (saved) {
        try {
            const config = JSON.parse(saved);
            document.getElementById('apiKey').value = config.apiKey || '';
            document.getElementById('projectId').value = config.projectId || '';
            document.getElementById('authDomain').value = config.authDomain || '';
            document.getElementById('storageBucket').value = config.storageBucket || '';
            document.getElementById('messagingSenderId').value = config.messagingSenderId || '';
            document.getElementById('appId').value = config.appId || '';
        } catch (e) {
            console.error('Firebase 설정 파싱 오류:', e);
            localStorage.removeItem(SETTINGS_FIREBASE_KEY);
        }
    }
}

// 설정 저장
document.getElementById('firebaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const config = {
        apiKey: document.getElementById('apiKey').value.trim(),
        projectId: document.getElementById('projectId').value.trim(),
        authDomain: document.getElementById('authDomain').value.trim(),
        storageBucket: document.getElementById('storageBucket').value.trim(),
        messagingSenderId: document.getElementById('messagingSenderId').value.trim(),
        appId: document.getElementById('appId').value.trim()
    };

    localStorage.setItem(SETTINGS_FIREBASE_KEY, JSON.stringify(config));

    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = 'status-badge';
    statusEl.style.background = '#e0f2fe';
    statusEl.style.color = '#0369a1';
    statusEl.textContent = '● 저장됨';

    alert('설정이 저장되었습니다. "연결 테스트" 버튼을 눌러 연결을 확인하세요.');
});

// 연결 상태 업데이트
function updateConnectionStatus() {
    const statusEl = document.getElementById('connectionStatus');
    if (window.firebaseConfig?.isEnabled?.()) {
        statusEl.className = 'status-badge connected';
        statusEl.textContent = '● 연결됨';
        document.getElementById('migrateAllBtn').disabled = false;
    } else {
        statusEl.className = 'status-badge disconnected';
        statusEl.textContent = '● 미연결';
    }
}

// 연결 테스트
document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    const statusEl = document.getElementById('connectionStatus');
    const authStatusEl = document.getElementById('authFileStatus');

    statusEl.className = 'status-badge';
    statusEl.style.background = '#fef3c7';
    statusEl.style.color = '#92400e';
    statusEl.textContent = '● 연결 중...';

    try {
        // Firebase 초기화 시도
        const initialized = await window.firebaseConfig.initialize();

        if (initialized) {
            statusEl.className = 'status-badge connected';
            statusEl.style.background = '#dcfce7';
            statusEl.style.color = '#16a34a';
            statusEl.textContent = '● 연결됨';

            if (authStatusEl) {
                authStatusEl.className = 'status-badge connected';
                authStatusEl.textContent = '● 연결됨';
            }

            document.getElementById('migrateAllBtn').disabled = false;
            renderMigrationList();
            alert('클라우드 연결 성공!');
        } else {
            statusEl.className = 'status-badge disconnected';
            statusEl.style.background = '#fef3c7';
            statusEl.style.color = '#d97706';
            statusEl.textContent = '● 미연결';

            if (isElectron) {
                alert('클라우드 연결 실패.\n인증 파일이 등록되어 있는지 확인하세요.');
            } else {
                alert('클라우드 연결 실패.\n수동 설정값을 확인해주세요.');
            }
        }
    } catch (error) {
        statusEl.className = 'status-badge error';
        statusEl.style.background = '#fee2e2';
        statusEl.style.color = '#dc2626';
        statusEl.textContent = '● 연결 실패';
        console.error('연결 테스트 실패:', error);
        alert('연결 실패: ' + error.message);
    }
});

// 마이그레이션 목록 렌더링 (모든 연도 포함, DOM API 사용 - XSS 방지)
function renderMigrationList() {
    const container = document.getElementById('migrationList');
    const currentYear = new Date().getFullYear();
    const MIN_YEAR = 2020;

    container.innerHTML = '';

    SAMPLE_TYPES.forEach(type => {
        // 모든 연도의 데이터 수집
        let totalCount = 0;
        const yearDetails = [];

        for (let year = MIN_YEAR; year <= currentYear; year++) {
            const storageKey = `${type.storagePrefix}_${year}`;
            const data = localStorage.getItem(storageKey);
            let count = 0;
            if (data) {
                try { count = JSON.parse(data).length; } catch (e) { console.error(`${storageKey} 파싱 오류:`, e); }
            }
            if (count > 0) {
                totalCount += count;
                yearDetails.push(`${year}년: ${count}건`);
            }
        }

        // DOM 요소 생성
        const item = document.createElement('div');
        item.className = 'migration-item';

        const info = document.createElement('div');
        info.className = 'migration-item-info';

        const icon = document.createElement('span');
        icon.className = 'migration-item-icon';
        icon.textContent = type.icon;

        const textDiv = document.createElement('div');

        const name = document.createElement('div');
        name.className = 'migration-item-name';
        name.textContent = type.name;

        const count = document.createElement('div');
        count.className = 'migration-item-count';
        count.textContent = `${totalCount}건 ${yearDetails.length > 0 ? '(' + yearDetails.join(', ') + ')' : ''}`;

        textDiv.appendChild(name);
        textDiv.appendChild(count);
        info.appendChild(icon);
        info.appendChild(textDiv);

        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = '마이그레이션';
        btn.disabled = totalCount === 0;
        btn.addEventListener('click', () => migrateTypeAllYears(type.key, type.storagePrefix));

        item.appendChild(info);
        item.appendChild(btn);
        container.appendChild(item);
    });
}

// 개별 타입의 모든 연도 마이그레이션
async function migrateTypeAllYears(sampleType, storagePrefix) {
    if (!window.storageManager?.isCloudEnabled()) {
        alert('클라우드가 연결되지 않았습니다.');
        return;
    }

    const currentYear = new Date().getFullYear();
    const MIN_YEAR = 2020;
    let totalCount = 0;
    let successYears = [];

    try {
        for (let year = MIN_YEAR; year <= currentYear; year++) {
            const storageKey = `${storagePrefix}_${year}`;
            const data = localStorage.getItem(storageKey);
            if (data) {
                const result = await window.storageManager.migrate(sampleType, year, storageKey);
                if (result.success && result.count > 0) {
                    totalCount += result.count;
                    successYears.push(`${year}년: ${result.count}건`);
                }
            }
        }

        if (totalCount > 0) {
            alert(`마이그레이션 완료!\n\n총 ${totalCount}건\n${successYears.join('\n')}`);
            renderMigrationList();
        } else {
            alert('마이그레이션할 데이터가 없습니다.');
        }
    } catch (error) {
        alert('마이그레이션 중 오류 발생: ' + error.message);
    }
}

// 전체 마이그레이션 (모든 타입, 모든 연도)
document.getElementById('migrateAllBtn').addEventListener('click', async () => {
    if (!confirm('모든 데이터를 클라우드로 마이그레이션하시겠습니까?\n(2020년 ~ 현재 연도의 모든 데이터)')) {
        return;
    }

    const currentYear = new Date().getFullYear();
    const MIN_YEAR = 2020;
    let totalCount = 0;
    let details = [];

    for (const type of SAMPLE_TYPES) {
        let typeCount = 0;

        for (let year = MIN_YEAR; year <= currentYear; year++) {
            const storageKey = `${type.storagePrefix}_${year}`;
            const data = localStorage.getItem(storageKey);
            if (data) {
                try {
                    const result = await window.storageManager.migrate(type.key, year, storageKey);
                    if (result.success && result.count > 0) {
                        totalCount += result.count;
                        typeCount += result.count;
                    }
                } catch (error) {
                    console.error(`${type.name} ${year}년 마이그레이션 실패:`, error);
                }
            }
        }

        if (typeCount > 0) {
            details.push(`${type.name}: ${typeCount}건`);
        }
    }

    alert(`전체 마이그레이션 완료!\n\n총 ${totalCount}건\n${details.join('\n')}`);
    renderMigrationList();
});

// 전체 데이터 내보내기
document.getElementById('exportAllBtn').addEventListener('click', () => {
    const currentYear = new Date().getFullYear();
    const allData = {};

    SAMPLE_TYPES.forEach(type => {
        const storageKey = `${type.storagePrefix}_${currentYear}`;
        const data = localStorage.getItem(storageKey);
        if (data) {
            try { allData[type.key] = JSON.parse(data); } catch (e) { console.error(`${type.key} 파싱 오류:`, e); }
        }
        // 부속 데이터(예: 퇴비 검정결과) — 빠지면 사용자가 백업했다고 믿고 PC를 교체할 때
        // 해당 데이터만 조용히 사라진다 (SLS-1-195)
        (type.extraKeys || []).forEach(prefix => {
            const extraKey = `${prefix}_${currentYear}`;
            const extraData = localStorage.getItem(extraKey);
            if (extraData) {
                try { allData[prefix] = JSON.parse(extraData); } catch (e) { console.error(`${prefix} 파싱 오류:`, e); }
            }
        });
    });

    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-log-backup-${currentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

// ========================================
// 캐시 관리 UI
// ========================================

// 캐시 상태 표시
function updateCacheStatusUI() {
    if (!window.CacheManager) return;

    const status = CacheManager.getCacheStatus();

    document.getElementById('cacheDataCount').textContent = `${status.totalKeys}건`;
    document.getElementById('cacheDataSize').textContent = `${status.totalSizeMB} MB`;

    const lastClearEl = document.getElementById('lastCacheClear');
    if (status.lastClear.lastClear) {
        const lastDate = status.lastClear.lastClear;
        lastClearEl.textContent = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')} ${String(lastDate.getHours()).padStart(2, '0')}:${String(lastDate.getMinutes()).padStart(2, '0')}`;
    } else {
        lastClearEl.textContent = '없음';
    }
}

// 캐시 삭제 버튼
document.getElementById('clearCacheBtn').addEventListener('click', () => {
    if (!confirm('예전 버전에서 남은 자료를 정리하시겠습니까?\n\n토양·퇴비 접수 자료와 설정은 삭제되지 않습니다.')) {
        return;
    }

    if (window.CacheManager) {
        CacheManager.clearCache(true);
        updateCacheStatusUI();
    }
});

// 상태 새로고침 버튼
document.getElementById('refreshCacheStatusBtn').addEventListener('click', () => {
    updateCacheStatusUI();
});

// 초기 상태 표시
updateCacheStatusUI();

// ========================================
// 네트워크 접근 제어 UI
// ========================================

function initNetworkAccessUI() {
    if (!window.NetworkAccess) return;

    const statusEl = document.getElementById('networkAccessStatus');
    const envEl = document.getElementById('currentEnvironment');
    const gatewayEl = document.getElementById('allowedGateway');
    const publicIPEl = document.getElementById('currentPublicIP');
    const accessEl = document.getElementById('currentAccessStatus');

    // 환경 표시
    const isElectron = window.electronAPI?.isElectron === true || window.location.protocol === 'file:';
    envEl.textContent = isElectron ? 'Electron (항상 허용)' : '웹 브라우저';

    // 허용된 게이트웨이 표시
    const allowedGateway = NetworkAccess.getAllowedGateway();
    if (allowedGateway) {
        gatewayEl.textContent = allowedGateway;
    } else {
        gatewayEl.textContent = '설정 없음';
        gatewayEl.style.color = '#dc2626';
    }

    // 네트워크 상태 확인
    async function refreshNetworkStatus() {
        publicIPEl.textContent = '확인 중...';
        accessEl.textContent = '확인 중...';

        const publicIP = await NetworkAccess.getCurrentIP();
        publicIPEl.textContent = publicIP || '확인 불가';

        const access = await NetworkAccess.checkAccess();
        accessEl.textContent = access.allowed ? `허용 (${access.reason})` : `거부 (${access.reason})`;
        accessEl.style.color = access.allowed ? '#16a34a' : '#dc2626';

        // 상태 배지 업데이트
        if (access.allowed) {
            statusEl.className = 'status-badge connected';
            statusEl.textContent = '● 허용';
        } else {
            statusEl.className = 'status-badge disconnected';
            statusEl.textContent = '● 거부';
        }
    }

    document.getElementById('checkNetworkBtn').addEventListener('click', refreshNetworkStatus);

    // 초기 상태 확인
    refreshNetworkStatus();
}

initNetworkAccessUI();

// ========================================
// 기관명 설정
// ========================================
// 전국 기관 배포용: 특정 기관명을 기본값으로 하드코딩하지 않는다(미설정 시 빈 값, placeholder 안내).
const DEFAULT_ORG_NAME = '';
const ORG_NAME_KEY = 'app_org_name';

function loadOrgName() {
    const saved = localStorage.getItem(ORG_NAME_KEY);
    document.getElementById('orgName').value = saved || DEFAULT_ORG_NAME;
}

document.getElementById('saveOrgNameBtn').addEventListener('click', () => {
    const value = document.getElementById('orgName').value.trim();
    if (!value) {
        alert('기관명을 입력해주세요.');
        return;
    }
    localStorage.setItem(ORG_NAME_KEY, value);
    const statusEl = document.getElementById('orgNameSaveStatus');
    statusEl.style.display = 'inline';
    setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
});

document.getElementById('resetOrgNameBtn').addEventListener('click', () => {
    if (!confirm('기관명을 초기화하시겠습니까?')) return;
    localStorage.removeItem(ORG_NAME_KEY);
    document.getElementById('orgName').value = DEFAULT_ORG_NAME;
    const statusEl = document.getElementById('orgNameSaveStatus');
    statusEl.textContent = '초기화됨';
    statusEl.style.display = 'inline';
    setTimeout(() => {
        statusEl.textContent = '저장됨';
        statusEl.style.display = 'none';
    }, 2000);
});

loadOrgName();

// ========================================
// 기본 시·도 설정 (필지 주소 검증용)
// ========================================
const DEFAULT_SIDO_KEY = 'app_default_sido';

function loadDefaultSido() {
    const saved = localStorage.getItem(DEFAULT_SIDO_KEY);
    const el = document.getElementById('defaultSido');
    if (el) el.value = saved || '';
}

const saveDefaultSidoBtn = document.getElementById('saveDefaultSidoBtn');
if (saveDefaultSidoBtn) {
    saveDefaultSidoBtn.addEventListener('click', () => {
        const value = document.getElementById('defaultSido').value;
        if (value) {
            localStorage.setItem(DEFAULT_SIDO_KEY, value);
        } else {
            localStorage.removeItem(DEFAULT_SIDO_KEY);
        }
        const statusEl = document.getElementById('defaultSidoSaveStatus');
        if (statusEl) {
            statusEl.style.display = 'inline';
            setTimeout(() => { statusEl.style.display = 'none'; }, 2000);
        }
    });
}

loadDefaultSido();

// 초기화
loadSavedConfig();
renderMigrationList();

// 인증 파일 상태 확인: queueMicrotask로 모듈 평가 완료 후 실행
// (settings-entry.js의 window.DOMPurify 설정이 모든 import 평가 뒤 body에서 이뤄지므로,
//  동기 top-level 호출 시점에는 window.DOMPurify가 아직 undefined임)
queueMicrotask(() => checkAuthFileStatus());

// 연결 상태 확인
(async function() {
    if (window.storageManager) {
        const mode = await window.storageManager.init();
        const statusEl = document.getElementById('connectionStatus');
        if (mode === 'cloud') {
            statusEl.className = 'status-badge connected';
            statusEl.textContent = '● 연결됨';
            document.getElementById('migrateAllBtn').disabled = false;

            // 인증 파일 섹션도 연결됨으로 표시
            const authStatusEl = document.getElementById('authFileStatus');
            if (authStatusEl) {
                authStatusEl.className = 'status-badge connected';
                authStatusEl.textContent = '● 연결됨';
            }
        }
    }
})();

// ========================================
// 연도별 데이터 삭제 (보관 기한 3년)
// ========================================
const YEAR_PURGE_RETENTION = 3;          // 보관 연수
const YEAR_PURGE_MIN_YEAR = 2020;        // 조회 시작 연도 (마이그레이션 로직과 동일 기준)
// SLS-1-195: 토양 전용 상수(YEAR_PURGE_PREFIX/YEAR_PURGE_SAMPLE_TYPE)를 제거하고
// SAMPLE_TYPES에서 파생한다.
// ⚠️ 이 삭제 기능은 보존기한 준수 목적이며, 퇴비 레코드는 성명·생년월일·법인번호·연락처·주소를
//    담는다. 여기서 빠진 시료 종은 "삭제 완료" 안내 후에도 로컬·클라우드·자동저장 파일에
//    그대로 남는다 = 컴플라이언스 오보. 시료 종 추가 시 반드시 SAMPLE_TYPES만 갱신하면 되도록
//    개별 상수를 두지 말 것.

/** 삭제 대상 임계 연도(이 연도 이하가 삭제 대상). 예: 2026년 → 2023 */
function getYearPurgeThreshold() {
    return new Date().getFullYear() - YEAR_PURGE_RETENTION;
}

/** 연도별 보유 현황 수집(건수 0인 연도는 제외) */
function collectYearInventory() {
    const currentYear = new Date().getFullYear();
    const threshold = getYearPurgeThreshold();
    const rows = [];
    for (let year = YEAR_PURGE_MIN_YEAR; year <= currentYear; year++) {
        // 전 시료 종 합산 — 한 종이라도 데이터가 있으면 그 연도는 삭제 대상 목록에 올라야 한다
        let count = 0;
        for (const type of SAMPLE_TYPES) {
            const raw = localStorage.getItem(`${type.storagePrefix}_${year}`);
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) count += parsed.length;
            } catch (e) {
                console.error(`${type.storagePrefix}_${year} 파싱 오류:`, e);
            }
        }
        if (count > 0) {
            rows.push({ year, count, deletable: year <= threshold, isCurrent: year === currentYear });
        }
    }
    return rows;
}

/** 선택 합계 갱신 + 삭제 버튼 활성/비활성 */
function updateYearPurgeSelection() {
    const list = document.getElementById('yearPurgeList');
    const btn = document.getElementById('purgeYearsBtn');
    const summary = document.getElementById('yearPurgeSelectedSummary');
    if (!list || !btn || !summary) return;

    const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
    const totalCount = checked.reduce((sum, cb) => sum + (parseInt(cb.dataset.count, 10) || 0), 0);
    btn.disabled = checked.length === 0;
    summary.textContent = checked.length === 0
        ? ''
        : `선택: ${checked.length}개 연도 · ${totalCount.toLocaleString('ko-KR')}건`;
}

/** 연도별 삭제 목록 렌더 */
function renderYearPurgeList() {
    const list = document.getElementById('yearPurgeList');
    const info = document.getElementById('yearPurgeThresholdInfo');
    if (!list) return;

    const currentYear = new Date().getFullYear();
    const threshold = getYearPurgeThreshold();
    if (info) info.textContent = `(${currentYear}년 기준 ${threshold}년 이전 자료)`;

    const rows = collectYearInventory();
    list.innerHTML = '';

    if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size: 0.85rem; color: #64748b; padding: 0.5rem;';
        empty.textContent = '삭제할 수 있는 연도별 데이터가 없습니다.';
        list.appendChild(empty);
        updateYearPurgeSelection();
        return;
    }

    rows.sort((a, b) => a.year - b.year).forEach(({ year, count, deletable, isCurrent }) => {
        const rowLabel = document.createElement('label');
        rowLabel.style.cssText = 'display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; cursor: pointer;' +
            (deletable ? ' background: #fef2f2; border-color: #fecaca;' : ' background: #f8fafc;');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.year = String(year);
        cb.dataset.count = String(count);
        cb.checked = deletable;            // 삭제 대상은 기본 선택
        cb.disabled = !deletable;          // 보관 기간 내 연도는 보호(실수 삭제 방지)
        if (deletable) cb.addEventListener('change', updateYearPurgeSelection);

        const yearText = document.createElement('span');
        yearText.style.cssText = 'font-weight: 600; min-width: 4.5rem;';
        yearText.textContent = `${year}년`;

        const countText = document.createElement('span');
        countText.style.cssText = 'flex: 1; color: #475569; font-size: 0.9rem;';
        countText.textContent = `${count.toLocaleString('ko-KR')}건`;

        rowLabel.appendChild(cb);
        rowLabel.appendChild(yearText);
        rowLabel.appendChild(countText);

        if (deletable) {
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size: 0.72rem; font-weight: 600; color: #dc2626; background: #fee2e2; padding: 0.15rem 0.5rem; border-radius: 999px;';
            badge.textContent = '3년 경과 · 삭제 권장';
            rowLabel.appendChild(badge);
        } else if (isCurrent) {
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size: 0.72rem; font-weight: 600; color: #2563eb; background: #dbeafe; padding: 0.15rem 0.5rem; border-radius: 999px;';
            badge.textContent = '올해';
            rowLabel.appendChild(badge);
        }

        list.appendChild(rowLabel);
    });

    updateYearPurgeSelection();
}

/** 단일 연도 데이터 삭제: Firestore → localStorage → 자동저장 파일 순. 반환: {cloud} */
async function purgeYearData(year) {
    let cloudDeleted = 0;

    // 전 시료 종을 순회한다 (SLS-1-195). 한 종이라도 빠지면 "삭제 완료" 안내 후 데이터가 남는다.
    for (const type of SAMPLE_TYPES) {
        // 1) Firestore 컬렉션 비우기 (클라우드 사용 시)
        if (window.firestoreDb?.isEnabled?.()) {
            try {
                const docs = await window.firestoreDb.getAll(type.key, year);
                for (const doc of docs) {
                    if (doc && doc.id != null) {
                        await window.firestoreDb.delete(type.key, year, doc.id);
                        cloudDeleted++;
                    }
                }
            } catch (e) {
                console.error(`${year}년 ${type.name} 클라우드 삭제 오류:`, e);
                throw new Error(`${year}년 ${type.name} 클라우드 삭제 중 오류: ${e.message}`);
            }
        }

        // 2) localStorage 제거 — 부속 데이터(extraKeys)까지 함께 지운다.
        //    검정결과를 남겨두면 삭제된 시료의 연도별 결과만 잔존한다.
        localStorage.removeItem(`${type.storagePrefix}_${year}`);
        (type.extraKeys || []).forEach(prefix => localStorage.removeItem(`${prefix}_${year}`));

        // 3) Electron 자동저장 파일 비우기 (best-effort — 실패해도 진행)
        //    주의: window.isElectron은 file-api.js에서만 노출되며 설정 페이지는 미로드 → 모듈 최상위 isElectron(line 12) 사용.
        //    이 비우기를 건너뛰면 해당 시료 페이지 재진입 시 잔존 auto-save 파일에서 삭제분이 부활함.
        if (isElectron && window.electronAPI?.getAutoSavePath && window.electronAPI?.writeFile) {
            try {
                const path = await window.electronAPI.getAutoSavePath(type.key, year);
                if (path) await window.electronAPI.writeFile(path, '[]');
            } catch (e) {
                console.warn(`${year}년 ${type.name} 자동저장 파일 정리 실패(무시):`, e);
            }
        }
    }

    return { cloud: cloudDeleted };
}

/** 선택 연도 일괄 삭제 (2단계 확인) */
async function purgeSelectedYears() {
    const list = document.getElementById('yearPurgeList');
    const btn = document.getElementById('purgeYearsBtn');
    if (!list || !btn) return;

    const checked = Array.from(list.querySelectorAll('input[type="checkbox"]:checked'));
    if (checked.length === 0) { alert('삭제할 연도를 선택해주세요.'); return; }

    const targets = checked.map(cb => ({
        year: parseInt(cb.dataset.year, 10),
        count: parseInt(cb.dataset.count, 10) || 0
    })).sort((a, b) => a.year - b.year);
    const totalCount = targets.reduce((s, t) => s + t.count, 0);
    const detail = targets.map(t => `· ${t.year}년 (${t.count.toLocaleString('ko-KR')}건)`).join('\n');

    // 1단계: 내용 확인
    if (!confirm(`다음 연도의 자료를 영구 삭제합니다.\n\n${detail}\n\n총 ${totalCount.toLocaleString('ko-KR')}건\n삭제한 자료는 복구할 수 없습니다. 계속하시겠습니까?`)) {
        return;
    }
    // 2단계: 오삭제 방지 — '삭제' 입력
    const typed = prompt(`삭제를 확정하려면 아래에 '삭제'라고 입력하세요.\n(연도 ${targets.map(t => t.year).join(', ')} · 총 ${totalCount.toLocaleString('ko-KR')}건)`);
    if (typed === null) return;
    if (typed.trim() !== '삭제') { alert('입력이 일치하지 않아 취소되었습니다.'); return; }

    const refreshBtn = document.getElementById('refreshYearPurgeBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '삭제 중...';
    if (refreshBtn) refreshBtn.disabled = true; // 진행 중 목록 새로고침 차단(상태 혼란 방지)

    const succeeded = [];
    const failed = [];
    let cloudTotal = 0;
    let succeededCount = 0; // 실제 삭제 성공한 연도의 건수만 합산(부분 실패 시 과대 보고 방지)
    for (const t of targets) {
        try {
            const { cloud } = await purgeYearData(t.year);
            cloudTotal += cloud;
            succeeded.push(t.year);
            succeededCount += t.count;
        } catch (e) {
            failed.push(`${t.year}년: ${e.message}`);
        }
    }

    btn.textContent = originalText;
    if (refreshBtn) refreshBtn.disabled = false;
    renderYearPurgeList(); // 목록 갱신(버튼 상태도 재계산)

    let msg = '';
    if (succeeded.length > 0) {
        msg += `삭제 완료: ${succeeded.join(', ')}년 (총 ${succeededCount.toLocaleString('ko-KR')}건`;
        msg += cloudTotal > 0 ? `, 클라우드 ${cloudTotal.toLocaleString('ko-KR')}건 포함)` : ')';
    }
    if (failed.length > 0) {
        msg += `${msg ? '\n\n' : ''}일부 실패:\n${failed.join('\n')}`;
    }
    alert(msg || '삭제할 데이터가 없습니다.');
}

document.getElementById('purgeYearsBtn')?.addEventListener('click', purgeSelectedYears);
document.getElementById('refreshYearPurgeBtn')?.addEventListener('click', renderYearPurgeList);
renderYearPurgeList();

// ========================================
// 작물 데이터 관리 UI (SLS-1-179)
// ========================================

// 상태 박스 갱신.
// count/version/updatedAt/source를 모두 동일한 로컬 envelope 하나에서 도출한다.
// (설정 페이지는 loadCropDataOnStartup을 호출하지 않아 window.CROP_DATA가 항상 번들값이므로,
//  실제 업로드 건수를 반영하려면 envelope의 data.length를 우선 사용해야 한다 — SLS-1-179 리뷰 MAJOR-1)
async function updateCropDataStatusUI() {
    const verEl = document.getElementById('cropDataVersion');
    const countEl = document.getElementById('cropDataCount');
    const updEl = document.getElementById('cropDataUpdatedAt');
    const srcEl = document.getElementById('cropDataSource');
    if (!verEl || !countEl || !updEl || !srcEl) return;

    // 로컬 envelope 우선. 없으면(특히 웹 환경은 로컬 파일이 없음) Firestore를 조회해
    // 실제 동기화된 상태를 표시한다(리뷰 MINOR-2 — soil 페이지 loadCropDataOnStartup과 동일 폴백).
    let envelope = null;
    let fromCloud = false;
    try {
        envelope = await window.CropDataLoader?.readLocalEnvelope?.();
    } catch { /* ignore */ }
    if (!envelope) {
        try {
            const remote = await window.firestoreDb?.getCropDataConfig?.();
            if (remote && Array.isArray(remote.data)) { envelope = remote; fromCloud = true; }
        } catch { /* ignore */ }
    }

    const count = Array.isArray(envelope?.data)
        ? envelope.data.length
        : (Array.isArray(window.CROP_DATA) ? window.CROP_DATA.length : 0);
    countEl.textContent = count ? `${count.toLocaleString()}건` : '-';

    if (envelope) {
        verEl.textContent = envelope.version || '-';
        updEl.textContent = envelope.updatedAt ? String(envelope.updatedAt).slice(0, 10) : '-';
        if (fromCloud) {
            srcEl.textContent = '클라우드';
        } else {
            srcEl.textContent = window.firebaseConfig?.isEnabled?.() ? '로컬 + 클라우드' : '로컬';
        }
    } else {
        verEl.textContent = '내장 기본값';
        updEl.textContent = '-';
        srcEl.textContent = window.firebaseConfig?.isEnabled?.() ? '앱 내장 + 클라우드' : '앱 내장';
    }
}

// 업로드 버튼
document.getElementById('cropDataUploadBtn')?.addEventListener('click', async () => {
    const Loader = window.CropDataLoader;
    if (!Loader) { showToast('작물 데이터 모듈 로드 실패', 'error'); return; }

    const fileInput = document.getElementById('cropDataFile');
    const file = fileInput?.files?.[0];
    if (!file) { showToast('업로드할 .xlsx 파일을 선택하세요', 'warning'); return; }

    const btn = document.getElementById('cropDataUploadBtn');
    const progress = document.getElementById('cropDataProgress');
    btn.disabled = true;
    btn.textContent = '⏳ 처리 중...';
    progress?.classList.remove('hidden');

    try {
        const buf = await file.arrayBuffer();
        const parsed = Loader.parseCropExcelFile(buf); // 실패 시 throw → 기존 데이터 보존
        const prevCount = Array.isArray(window.CROP_DATA) ? window.CROP_DATA.length : 0;

        const ok = confirm(
            `작물 ${parsed.length.toLocaleString()}건을 불러왔습니다.\n` +
            `(기존 ${prevCount.toLocaleString()}건 → 신규 ${parsed.length.toLocaleString()}건)\n\n` +
            '적용하시겠습니까?'
        );
        if (!ok) return;

        const versionLabel = new Date().toISOString().slice(0, 10);
        await Loader.saveCropDataUpload(parsed, versionLabel);

        showToast(`작물 데이터가 갱신되었습니다 (${parsed.length.toLocaleString()}건)`, 'success');
        if (fileInput) fileInput.value = '';
        await updateCropDataStatusUI();
    } catch (e) {
        showToast(`작물 데이터 처리 실패: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📤 업로드';
        progress?.classList.add('hidden');
    }
});

// 페이지 로드 시 상태 표시
updateCropDataStatusUI();

// ============================================================
// 접수번호 정합성 점검 (SLS-1-223)
//
// 성토 시료는 접수번호가 'F'로 시작해야 한다(F 접두 ⟺ 구분='성토').
// 이 불변식이 깨진 레코드는 채번 풀 분류가 어긋나 조용한 중복의 원인이 된다.
// 읽기 전용이다 — 재번호는 접수번호가 이미 라벨·흙토람 내보내기에 쓰였을 수 있어
// 담당자 판단이 필요하다.
// ============================================================

/** localStorage의 모든 연도별 토양 접수 자료를 모은다 */
function collectAllSoilLogs() {
    const byYear = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const m = key && key.match(/^soilSampleLogs_(\d{4})$/);
        if (!m) continue;
        let logs = [];
        let broken = false;
        try {
            const parsed = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(parsed)) logs = parsed;
            else broken = true;      // 배열이 아니면 읽을 수 없는 상태다
        } catch (_) {
            broken = true;           // 파싱 불가를 '이상 없음'에 합산하지 않는다
        }
        byYear.push({ year: Number(m[1]), logs, broken });
    }
    return byYear.sort((a, b) => a.year - b.year);
}

/** 결과 표의 한 행 */
function auditRow(cells, opts) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 0.75rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; font-size: 0.85rem;'
        + (opts && opts.header ? ' font-weight: 600; color: #334155; background: #f8fafc;' : ' color: #475569;');
    cells.forEach((text, i) => {
        const cell = document.createElement('span');
        cell.style.cssText = i === cells.length - 1 ? 'flex: 1;' : 'min-width: 5.5rem;';
        cell.textContent = text;   // 사용자 데이터 — textContent로만 넣는다
        row.appendChild(cell);
    });
    return row;
}

function renderAuditResult(byYear) {
    const box = document.getElementById('auditReceptionResult');
    if (!box) return;
    box.textContent = '';

    const RN = window.ReceptionNumber;
    if (!RN || typeof RN.auditReceptionNumbers !== 'function') {
        box.appendChild(auditRow(['점검 모듈을 불러올 수 없습니다. 페이지를 새로고침해 주세요.']));
        return;
    }

    let totalRecords = 0;
    let totalViolations = 0;
    let totalDuplicates = 0;
    let totalMalformed = 0;

    const ROW_LIMIT = 200;   // 대량 데이터에서 동기 렌더가 화면을 멈추지 않게
    let brokenYears = 0;

    for (const { year, logs, broken } of byYear) {
        if (broken) brokenYears++;
        const { violations, duplicates, malformed } = RN.auditReceptionNumbers(logs);
        totalRecords += logs.length;
        totalViolations += violations.length;
        totalDuplicates += duplicates.length;
        totalMalformed += malformed.length;
        if (violations.length === 0 && duplicates.length === 0 && malformed.length === 0) continue;

        const title = document.createElement('div');
        title.style.cssText = 'margin-top: 0.75rem; font-weight: 600; color: #b91c1c;';
        title.textContent = `${year}년 — 규칙 위반 ${violations.length}건 / 중복 번호 ${duplicates.length}건`
            + (malformed.length ? ` / 번호 읽기 불가 ${malformed.length}건` : '');
        box.appendChild(title);

        const table = document.createElement('div');
        table.style.cssText = 'border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-top: 0.4rem;';
        table.appendChild(auditRow(['구분', '접수번호', '성명', '사유'], { header: true }));

        let shown = 0;
        const add = (cells) => { if (shown < ROW_LIMIT) { table.appendChild(auditRow(cells)); shown++; } };
        for (const v of violations) add([v.subCategory || '-', v.receptionNumber, v.name || '-', v.reason]);
        for (const m of malformed) add([m.subCategory || '-', m.receptionNumber, m.name || '-', m.reason]);
        for (const d of duplicates) {
            const names = d.records.map(r => r.name || '-').join(', ');
            add([d.landClass1, d.base, `${d.count}건`, `같은 번호가 ${d.count}건 (${names})`]);
        }
        const total = violations.length + malformed.length + duplicates.length;
        if (total > shown) table.appendChild(auditRow([`… 외 ${total - shown}건 생략`]));
        box.appendChild(table);
    }

    const summary = document.createElement('div');
    const problems = totalViolations + totalDuplicates + totalMalformed;
    const nothingToCheck = byYear.length === 0;
    // 확인하지 않은 상태를 '이상 없음'과 같은 색으로 보고하지 않는다.
    // 설정 화면은 토양 데이터를 로드하지 않으므로, 담당자가 해당 연도를 한 번도 열지
    // 않은 기기에서는 저장소가 비어 있다 — 그것은 '이상 없음'이 아니다.
    const clean = !nothingToCheck && problems === 0 && brokenYears === 0;
    summary.style.cssText = 'margin-top: 0.75rem; padding: 0.75rem; border-radius: 8px; font-size: 0.9rem;'
        + (clean ? ' background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534;'
                 : nothingToCheck ? ' background: #fffbeb; border: 1px solid #fde68a; color: #92400e;'
                 : ' background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;');
    if (nothingToCheck) {
        summary.textContent = '확인할 자료가 없습니다 — 이 기기의 저장소에 토양 접수 자료가 없습니다. '
            + '토양 화면에서 대상 연도를 먼저 열어 주세요. (클라우드에만 있는 자료는 이 점검 대상이 아닙니다.)';
    } else if (clean) {
        summary.textContent = `이상 없음 — ${byYear.length}개 연도 ${totalRecords}건을 확인했습니다.`;
    } else {
        const parts = [];
        if (totalViolations) parts.push(`규칙 위반 ${totalViolations}건`);
        if (totalDuplicates) parts.push(`중복 번호 ${totalDuplicates}건`);
        if (totalMalformed) parts.push(`번호 읽기 불가 ${totalMalformed}건`);
        if (brokenYears) parts.push(`읽을 수 없는 연도 ${brokenYears}개`);
        summary.textContent = `확인 필요 — ${parts.join(', ')}. `
            + '접수번호는 라벨·내보내기에 이미 쓰였을 수 있어 자동으로 고치지 않습니다.';
    }
    box.appendChild(summary);
}

document.getElementById('auditReceptionBtn')?.addEventListener('click', () => {
    renderAuditResult(collectAllSoilLogs());
});
