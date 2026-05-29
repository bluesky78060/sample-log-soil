// Firebase 설정 저장 키 (firebase-config.js의 FIREBASE_CONFIG_KEY와 동일 값)
const SETTINGS_FIREBASE_KEY = 'firebase_config';
const SAMPLE_TYPES = [
    { key: 'soil', name: '토양', icon: '🌱', storagePrefix: 'soilSampleLogs' },
    { key: 'water', name: '수질분석', icon: '💧', storagePrefix: 'waterSampleLogs' },
    { key: 'pesticide', name: '잔류농약', icon: '🧪', storagePrefix: 'pesticideSampleLogs' },
    { key: 'compost', name: '가축분뇨퇴비', icon: '🐄', storagePrefix: 'compostSampleLogs' },
    { key: 'heavyMetal', name: '토양 중금속', icon: '⚗️', storagePrefix: 'heavyMetalSampleLogs' }
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
            'Firebase 접근을 위한 인증 파일을 업로드하면 자동으로 설정됩니다.<br>' +
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
                    alert('인증 파일이 적용되고 Firebase가 연결되었습니다.\n프로젝트: ' + config.projectId);
                } else {
                    alert('인증 파일이 저장되었지만 Firebase 연결에 실패했습니다.\n페이지를 새로고침해주세요.');
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
                    alert('인증 파일이 등록되고 Firebase가 연결되었습니다.\n프로젝트: ' + config.projectId);
                } else {
                    alert('인증 파일은 등록되었지만 Firebase 연결에 실패했습니다.\n앱을 재시작해주세요.');
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
    if (!confirm('인증 파일을 삭제하시겠습니까?\nFirebase 연결이 해제됩니다.')) {
        return;
    }

    if (!isElectron) {
        // 웹 환경: localStorage에서 삭제
        if (window.firebaseConfig?.resetConfig) {
            window.firebaseConfig.resetConfig();
        }
        alert('Firebase 설정이 삭제되었습니다.');
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
                        alert('인증 파일이 등록되고 Firebase가 연결되었습니다.\n프로젝트: ' + result.projectId);
                    } else {
                        alert('인증 파일은 등록되었지만 Firebase 연결에 실패했습니다.\n앱을 재시작해주세요.');
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
            alert('Firebase 연결 성공!');
        } else {
            statusEl.className = 'status-badge disconnected';
            statusEl.style.background = '#fef3c7';
            statusEl.style.color = '#d97706';
            statusEl.textContent = '● 미연결';

            if (isElectron) {
                alert('Firebase 연결 실패.\n인증 파일이 등록되어 있는지 확인하세요.');
            } else {
                alert('Firebase 연결 실패.\n수동 설정값을 확인해주세요.');
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
        alert('Firebase가 연결되지 않았습니다.');
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
    if (!confirm('모든 데이터를 Firebase로 마이그레이션하시겠습니까?\n(2020년 ~ 현재 연도의 모든 데이터)')) {
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
    if (!confirm('캐시된 시료 데이터를 삭제하시겠습니까?\n\n삭제 후 앱을 새로고침하면 Firebase에서 데이터를 다시 불러옵니다.\n(Firebase 설정 및 연결 정보는 유지됩니다)')) {
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
// 식품안전나라 MRL API 관리
// ========================================
function formatRelativeTime(ms) {
    if (!ms) return '없음';
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (day > 0) return `${day}일 전`;
    if (hour > 0) return `${hour}시간 전`;
    if (min > 0) return `${min}분 전`;
    return '방금 전';
}

function formatDateTime(ms) {
    if (!ms) return '없음';
    const d = new Date(ms);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function setConnStatus(text, type) {
    const el = document.getElementById('mrlConnStatus');
    if (!el) return;
    el.textContent = text;
    el.style.color = type === 'ok' ? '#059669'
                    : type === 'warn' ? '#d97706'
                    : type === 'error' ? '#dc2626'
                    : '#64748b';
}

function updateMrlStatusUI() {
    const MrlApi = window.MrlApi;
    if (!MrlApi) {
        setConnStatus('MrlApi 모듈 로드 실패', 'error');
        return;
    }

    // 키 필드
    const keyInput = document.getElementById('mrlApiKey');
    if (keyInput) {
        keyInput.value = MrlApi.getApiKey() || '';
    }

    // 캐시 상태
    const status = MrlApi.getCacheStatus();
    const countEl = document.getElementById('mrlCacheCount');
    const lastEl = document.getElementById('mrlLastSync');
    const expEl = document.getElementById('mrlCacheExpiry');

    if (!status.cached) {
        if (countEl) countEl.textContent = '없음';
        if (lastEl) lastEl.textContent = '한 번도 동기화되지 않음';
        if (expEl) { expEl.textContent = '없음'; expEl.style.color = '#64748b'; }
    } else {
        if (countEl) countEl.textContent = `${status.count.toLocaleString()}건`;
        if (lastEl) lastEl.textContent = `${formatDateTime(status.timestamp)} (${formatRelativeTime(status.timestamp)})`;
        if (expEl) {
            if (status.expired) {
                expEl.textContent = '⚠️ 만료됨 (재동기화 권장)';
                expEl.style.color = '#d97706';
            } else {
                const ttlMs = MrlApi.CACHE_TTL_MS - status.ageMs;
                const daysLeft = Math.ceil(ttlMs / 86400000);
                expEl.textContent = `✅ 유효 (${daysLeft}일 남음)`;
                expEl.style.color = '#059669';
            }
        }
    }

    // 연결 상태
    if (!MrlApi.hasApiKey()) {
        setConnStatus('API 키 미설정', 'warn');
    } else if (status.cached && !status.expired) {
        setConnStatus('정상 (캐시 유효)', 'ok');
    } else if (status.cached && status.expired) {
        setConnStatus('캐시 만료 (재동기화 필요)', 'warn');
    } else {
        setConnStatus('API 키 있음 - 동기화 대기', 'warn');
    }
}

function showMrlProgress(show) {
    const bar = document.getElementById('mrlProgressBar');
    if (bar) bar.classList.toggle('hidden', !show);
}

function updateMrlProgress(loaded, total) {
    const fill = document.getElementById('mrlProgressFill');
    const text = document.getElementById('mrlProgressText');
    const pct = total > 0 ? (loaded / total) * 100 : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `${loaded.toLocaleString()} / ${total.toLocaleString()} (${pct.toFixed(0)}%)`;
}

// API 키 저장
document.getElementById('mrlApiKeySave')?.addEventListener('click', () => {
    const MrlApi = window.MrlApi;
    if (!MrlApi) { showToast('MrlApi 모듈 로드 실패', 'error'); return; }
    const input = document.getElementById('mrlApiKey');
    const key = (input?.value || '').trim();
    if (!key) {
        if (confirm('API 키를 비우시겠습니까? MRL 자동 조회가 비활성화됩니다.')) {
            MrlApi.setApiKey('');
            MrlApi.clearCache();
            updateMrlStatusUI();
            showToast('API 키가 제거되었습니다', 'info');
        }
        return;
    }
    MrlApi.setApiKey(key);
    showToast('API 키가 저장되었습니다', 'success');
    updateMrlStatusUI();
});

// 키 표시/숨김 토글
document.getElementById('mrlApiKeyToggle')?.addEventListener('click', () => {
    const input = document.getElementById('mrlApiKey');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
});

// 지금 동기화
document.getElementById('mrlSyncBtn')?.addEventListener('click', async () => {
    const MrlApi = window.MrlApi;
    if (!MrlApi) return;
    if (!MrlApi.hasApiKey()) {
        showToast('먼저 API 키를 저장하세요', 'warning');
        return;
    }

    const btn = document.getElementById('mrlSyncBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 동기화 중...';
    showMrlProgress(true);
    updateMrlProgress(0, 1);
    setConnStatus('다운로드 중...', 'warn');

    try {
        const result = await MrlApi.sync(({ loaded, total }) => {
            updateMrlProgress(loaded, total);
        });
        if (result.success) {
            showToast(`동기화 완료: ${result.count}건`, 'success');
        } else {
            showToast(`동기화 실패: ${result.error}`, 'error');
        }
    } catch (e) {
        showToast(`오류: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 지금 동기화';
        setTimeout(() => showMrlProgress(false), 1000);
        updateMrlStatusUI();
    }
});

// 연결 테스트
document.getElementById('mrlTestBtn')?.addEventListener('click', async () => {
    const MrlApi = window.MrlApi;
    if (!MrlApi) return;
    const key = MrlApi.getApiKey();
    if (!key) {
        showToast('먼저 API 키를 저장하세요', 'warning');
        return;
    }

    const btn = document.getElementById('mrlTestBtn');
    btn.disabled = true;
    btn.textContent = '⏳ 테스트 중...';
    setConnStatus('테스트 중...', 'warn');

    try {
        // 1건만 가져와서 검증 (HTTPS 사용)
        const url = `https://openapi.foodsafetykorea.go.kr/api/${encodeURIComponent(key)}/${MrlApi.SERVICE_ID}/json/1/1`;
        const res = await fetch(url);
        const text = await res.text();
        const contentType = (res.headers.get('content-type') || '').toLowerCase();

        if (contentType.includes('text/html') || text.trim().startsWith('<')) {
            setConnStatus('❌ 인증키 오류 또는 활성화 대기', 'error');
            showToast('인증키가 유효하지 않거나 아직 활성화되지 않았습니다', 'error');
            return;
        }

        const data = JSON.parse(text);
        const payload = data[MrlApi.SERVICE_ID];
        if (payload?.RESULT?.CODE === 'INFO-000') {
            const total = parseInt(payload.total_count || '0', 10);
            setConnStatus(`✅ 정상 (전체 ${total.toLocaleString()}건)`, 'ok');
            showToast(`연결 성공! 전체 ${total.toLocaleString()}건`, 'success');
        } else {
            setConnStatus(`❌ API 오류: ${payload?.RESULT?.MSG || 'Unknown'}`, 'error');
            showToast(`API 오류: ${payload?.RESULT?.MSG}`, 'error');
        }
    } catch (e) {
        setConnStatus(`❌ 네트워크 오류: ${e.message}`, 'error');
        showToast(`연결 실패: ${e.message}`, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔌 연결 테스트';
    }
});

// MRL 캐시 삭제
document.getElementById('mrlClearCacheBtn')?.addEventListener('click', () => {
    const MrlApi = window.MrlApi;
    if (!MrlApi) return;
    if (!confirm('MRL 캐시를 삭제하시겠습니까?\n다음 조회 시 다시 다운로드됩니다 (약 15초).')) {
        return;
    }
    MrlApi.clearCache();
    showToast('MRL 캐시가 삭제되었습니다', 'info');
    updateMrlStatusUI();
});

// 페이지 로드 시 상태 표시
updateMrlStatusUI();

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

// 인증 파일 상태 확인 (Electron)
checkAuthFileStatus();

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
