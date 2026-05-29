/**
 * @fileoverview Electron 메인 프로세스
 * @description 앱 초기화, 창 관리, IPC 핸들러 정의
 */

const { app, BrowserWindow, Menu, ipcMain, dialog, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { autoUpdater } = require('electron-updater');

/**
 * 최소 .env 로더 (dotenv 의존성 없이 동작)
 *
 * 동작 규칙:
 * - 프로젝트 루트의 ".env" 파일을 읽어 process.env에 주입
 * - 이미 정의된 환경 변수는 덮어쓰지 않음
 * - 파일이 없으면 조용히 무시
 * - 키 형식: 영문자/숫자/밑줄/마침표 (대소문자 모두 허용)
 *   ※ dotenv 표준과 호환되도록 소문자/혼합케이스 키도 인식
 * - 값 후행 공백은 trim (따옴표 외부 공백은 의도가 아니라고 가정)
 * - 따옴표 처리: 양끝 동일한 종류의 ' 또는 " 만 벗김
 *   ※ 이스케이프 시퀀스(\n, \t 등)는 미지원 (필요 시 dotenv 의존성 추가)
 */
// SLS-1-21: packaged Electron 환경에서도 동작하도록 다중 경로 시도
//   - 개발: <repo>/.env (__dirname/../.env)
//   - packaged: process.resourcesPath/.env (forge.config.js extraResource로 동봉)
(function loadDotEnv() {
    const candidates = [
        path.join(__dirname, '..', '.env'),
    ];
    if (process.resourcesPath) {
        candidates.push(path.join(process.resourcesPath, '.env'));
    }
    const envPath = candidates.find((p) => {
        try { return fs.existsSync(p); } catch { return false; }
    });
    if (!envPath) return;
    try {
        const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            if (!line || line.trim().startsWith('#')) continue;
            // 키: 첫 문자는 영문자/밑줄, 나머지는 영숫자/밑줄/마침표 허용
            const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)\s*$/);
            if (!m) continue;
            const [, key, raw] = m;
            let value = raw.trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
        console.log(`[env] .env 로드 완료: ${envPath}`);
    } catch (e) {
        console.warn('[env] .env 로드 실패:', e.message);
    }
})();

// 자동 업데이트 설정
autoUpdater.logger = console;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// GitHub 릴리스에서 업데이트 확인하도록 설정
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'bluesky78060',
  repo: 'sample-log-soil'
});

// Windows 설치/제거 시 바로가기 생성/삭제 처리
if (require('electron-squirrel-startup')) {
  app.quit();
}

/** @type {Electron.BrowserWindow | null} */
let mainWindow = null;

/** Vite 개발 서버 URL (전체 IPC 핸들러 공통) */

/**
 * M-3: 앱의 실제 docs 디렉토리 절대 경로 (will-navigate 검증용)
 * realpath로 심볼릭 링크 해석 (존재하지 않으면 resolve 경로 사용)
 */
const DOCS_DIR = (() => {
    const resolved = path.resolve(__dirname, '..', 'docs');
    try {
        return fs.realpathSync(resolved);
    } catch {
        return resolved;
    }
})();

/**
 * M-4: IPC 호출 Rate Limiting (DoS 방지)
 * 채널별 호출 횟수를 추적하여 과도한 호출을 차단
 *
 * 두 번째 인자로 채널별 임계값(maxCalls)을 지정 가능.
 * - 기본: 초당 30회 (파일 I/O 등 내부 작업)
 * - 외부 API(JUSO, VWorld 등): 초당 5회 권장 (사용자 측 키 보호 + 서비스 약관 준수)
 */
const ipcRateLimiter = (() => {
    const callCounts = new Map();
    const WINDOW_MS = 1000;  // 1초 윈도우
    const DEFAULT_MAX = 30;  // 기본 초당 호출 한도

    return {
        check(channel, maxCalls = DEFAULT_MAX) {
            const now = Date.now();
            const entry = callCounts.get(channel);

            if (!entry || now - entry.start > WINDOW_MS) {
                callCounts.set(channel, { start: now, count: 1 });
                return true;
            }

            entry.count++;
            if (entry.count > maxCalls) {
                console.warn(`[Rate Limit] ${channel}: ${entry.count}회/초 초과 (한도 ${maxCalls})`);
                return false;
            }
            return true;
        }
    };
})();

/**
 * 허용된 경로인지 검증 (Path Traversal 방지)
 * realpath를 사용하여 심볼릭 링크 해석 후 실제 경로 확인
 * @param {string} filePath - 검증할 파일 경로
 * @returns {{valid: boolean, resolvedPath?: string, error?: string}} 검증 결과
 */
async function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return { valid: false, error: '유효하지 않은 파일 경로입니다.' };
    }

    // 추가 보안 검사
    // 1. Null 바이트 검사
    if (filePath.includes('\0')) {
        return { valid: false, error: '잘못된 파일 경로입니다. (null byte detected)' };
    }

    // 2. 상대 경로 요소 검사 (정규화 전) - 더 엄격한 검사
    const dangerousPatterns = [
        '../', '..\\', // 기본 상대 경로
        '..%2F', '..%5C', // URL 인코딩된 상대 경로
        '%2e%2e%2f', '%2e%2e%5c', // URL 인코딩된 점
        '..%252f', '..%255c', // 이중 인코딩
        '/../', '/..\\', // 절대 경로 내 상대 경로
        '\\..\\'  // Windows UNC 경로
    ];

    for (const pattern of dangerousPatterns) {
        if (filePath.toLowerCase().includes(pattern.toLowerCase())) {
            return { valid: false, error: '상대 경로 패턴이 감지되었습니다.' };
        }
    }

    // 3. URL 인코딩 감지 및 차단
    if (/%[0-9a-fA-F]{2}/.test(filePath)) {
        return { valid: false, error: 'URL 인코딩된 경로는 허용되지 않습니다.' };
    }

    // 4. 파일명 유효성 검사 - 위험한 문자만 차단
    const basename = path.basename(filePath);
    const invalidFilenameChars = /[<>:"|?*\x00-\x1f\\]/;
    if (basename && invalidFilenameChars.test(basename)) {
        return { valid: false, error: '파일명에 허용되지 않은 문자가 포함되어 있습니다.' };
    }

    // 허용된 디렉토리 목록
    const allowedDirs = [
        app.getPath('userData'),      // 앱 데이터 폴더
        app.getPath('documents'),     // 문서 폴더
        app.getPath('downloads'),     // 다운로드 폴더
        app.getPath('desktop'),       // 바탕화면

        // 특정 하위 폴더만 허용
        path.join(app.getPath('documents'), 'SampleLog'),
        path.join(app.getPath('downloads'), 'SampleLog')
    ];

    // 사용자가 설정한 자동저장 폴더도 허용 경로에 추가
    try {
        const settings = loadSettings();
        if (settings.autoSaveFolder) {
            allowedDirs.push(settings.autoSaveFolder);
        }
    } catch (e) {
        // 설정 로드 실패 시 무시
    }

    try {
        // 경로를 절대 경로로 변환
        const absolutePath = path.resolve(filePath);

        // PER-10: 비동기 I/O로 전환 (메인 스레드 블로킹 방지)
        let realPath;
        try {
            await fs.promises.access(absolutePath);
            realPath = await fs.promises.realpath(absolutePath);
        } catch {
            // 파일이 없으면 부모 디렉토리 확인
            const parentDir = path.dirname(absolutePath);
            try {
                await fs.promises.access(parentDir);
                const realParent = await fs.promises.realpath(parentDir);
                realPath = path.join(realParent, path.basename(absolutePath));
            } catch {
                realPath = absolutePath;
            }
        }

        // 정규화된 실제 경로가 허용된 디렉토리 내부인지 확인
        const allowedChecks = await Promise.all(allowedDirs.map(async (allowedDir) => {
            try {
                let realAllowedDir;
                try {
                    await fs.promises.access(allowedDir);
                    realAllowedDir = await fs.promises.realpath(allowedDir);
                } catch {
                    realAllowedDir = allowedDir;
                }
                return realPath.startsWith(realAllowedDir + path.sep) || realPath === realAllowedDir;
            } catch {
                return false;
            }
        }));

        if (!allowedChecks.some(Boolean)) {
            return { valid: false, error: '허용되지 않은 경로입니다.' };
        }

        return { valid: true, resolvedPath: realPath };
    } catch (error) {
        return { valid: false, error: '경로 검증 중 오류가 발생했습니다.' };
    }
}

/**
 * 한글 메뉴 템플릿 생성
 * @returns {Electron.MenuItemConstructorOptions[]}
 */
const createMenuTemplate = () => {
  /** @type {Electron.MenuItemConstructorOptions[]} */
  const template = [
    {
      label: '파일',
      submenu: [
        { label: '새로고침', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '강제 새로고침', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '종료', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: '편집',
      submenu: [
        { label: '실행 취소', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '다시 실행', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '잘라내기', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '복사', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '붙여넣기', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '모두 선택', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '보기',
      submenu: [
        { label: '확대', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '축소', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: '원래 크기', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '전체 화면', accelerator: 'F11', role: 'togglefullscreen' },
        // L-3: 개발 모드에서만 DevTools 메뉴 표시
        ...(process.env.DEV_MODE === '1' || process.argv.includes('--dev') ? [
          { type: 'separator' },
          { label: '개발자 도구', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' }
        ] : [])
      ]
    },
    {
      label: '창',
      submenu: [
        { label: '최소화', accelerator: 'CmdOrCtrl+M', role: 'minimize' },
        { label: '닫기', accelerator: 'CmdOrCtrl+W', role: 'close' }
      ]
    }
  ];

  // macOS 앱 메뉴 추가
  if (process.platform === 'darwin') {
    template.unshift({
      label: '시료 접수 대장',
      submenu: [
        { label: '시료 접수 대장 정보', role: 'about' },
        { type: 'separator' },
        { label: '환경설정...', accelerator: 'Command+,', enabled: false },
        { type: 'separator' },
        { label: '서비스', role: 'services', submenu: [] },
        { type: 'separator' },
        { label: '시료 접수 대장 숨기기', accelerator: 'Command+H', role: 'hide' },
        { label: '기타 숨기기', accelerator: 'Command+Alt+H', role: 'hideOthers' },
        { label: '모두 표시', role: 'unhide' },
        { type: 'separator' },
        { label: '종료', accelerator: 'Command+Q', role: 'quit' }
      ]
    });
  }

  return template;
};

/**
 * 메인 윈도우 생성
 * @returns {void}
 */
const createWindow = () => {
  // 브라우저 창 생성
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: '시료 접수 대장',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
  });

  // 새 창 열기 차단: 외부 http(s) 링크만 시스템 브라우저로, 그 외(javascript: 등)는 거부
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { const p = new URL(url).protocol; if (p === 'http:' || p === 'https:') shell.openExternal(url); } catch { /* invalid url → deny */ }
    return { action: 'deny' };
  });

  // 앱 로드 전략:
  // 1. VITE_DEV_SERVER_URL 환경변수가 있으면 Vite dev server 사용
  // 2. 없으면 Vite dev server(localhost:3000)에 연결 시도
  // 3. 둘 다 안 되면 빌드된 docs/index.html 로드
  const docsPath = path.join(__dirname, '..', 'docs', 'index.html');

  /** @type {string|null} 현재 로드 원본 (dev server URL 또는 null) */
  let activeDevServerUrl = null;

  async function loadApp() {
    // Vite dev server 연결 시도
    try {
      const http = require('node:http');
      await new Promise((resolve, reject) => {
        const req = http.get(VITE_DEV_SERVER_URL, { timeout: 1000 }, (res) => {
          res.destroy();
          resolve();
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      });
      activeDevServerUrl = VITE_DEV_SERVER_URL;
      mainWindow.loadURL(VITE_DEV_SERVER_URL);
      console.log(`[App] Vite dev server에서 로드: ${VITE_DEV_SERVER_URL}`);
    } catch {
      // Vite dev server 없음 → 빌드된 파일에서 로드
      if (fs.existsSync(docsPath)) {
        mainWindow.loadFile(docsPath);
        console.log(`[App] 빌드된 파일에서 로드: ${docsPath}`);
      } else {
        // 빌드 파일도 없으면 에러 안내
        mainWindow.loadURL(`data:text/html;charset=utf-8,
          <h2 style="font-family:sans-serif;padding:2rem;">앱을 시작할 수 없습니다</h2>
          <p style="font-family:sans-serif;padding:0 2rem;">
            <code>npm run build</code> 로 빌드하거나<br>
            <code>npm run dev:electron</code> 으로 개발 모드를 시작해주세요.
          </p>`);
      }
    }
  }

  loadApp();

  // 내부 링크 네비게이션 허용 (soil/, water/ 등 하위 폴더)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (activeDevServerUrl && url.startsWith(activeDevServerUrl)) {
      return; // 개발 모드: 같은 dev server 내 URL 허용
    }
    // M-3: file:// 프로토콜이고 실제 docs 디렉토리 내의 파일이면 허용
    if (url.startsWith('file://')) {
      try {
        const fileUrl = new URL(url);
        const filePath = decodeURIComponent(fileUrl.pathname);
        // Windows: pathname이 /C:/... 형식 → 선행 슬래시 제거
        const normalizedPath = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath;
        let realFilePath;
        try {
          realFilePath = fs.realpathSync(normalizedPath);
        } catch {
          realFilePath = path.resolve(normalizedPath);
        }
        if (realFilePath.startsWith(DOCS_DIR + path.sep) || realFilePath === DOCS_DIR) {
          return;
        }
      } catch {
        // 경로 파싱 실패 시 차단
      }
    }
    event.preventDefault(); // 외부 URL 차단
  });

  // 개발 모드에서 DevTools 열기
  if (process.env.DEV_MODE === '1' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
};

// Electron 초기화 완료 후 브라우저 창 생성 준비
app.whenReady().then(() => {
  // CSP (Content-Security-Policy) 및 보안 헤더 설정
  // file:// 프로토콜에만 적용 (외부 URL은 가로채지 않음)
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['file:///*'] },  // 필터: file:// URL만 가로채기 (macOS/Linux)
    (details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; " +
          // Phase 4 현대화 완료:
          // - script-src: CDN → npm 번들 전환 완료 (Tailwind, SheetJS, DOMPurify, Firebase)
          //   unsafe-inline 제거 완료 (인라인 스크립트 → ES Modules)
          //   SLS-1-20: Kakao Postcode CDN 제거 (juso API 자체 모달로 전환)
          // - style-src: Tailwind CDN → 빌드 타임 CSS 전환 완료
          //   unsafe-inline 유지: JS에서 element.style.* 직접 조작 광범위하게 사용
          "script-src 'self' file:; " +
          "style-src 'self' 'unsafe-inline' file: https://fonts.googleapis.com; " +
          "font-src 'self' file: https://fonts.gstatic.com; " +
          "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://api.ipify.org https://openapi.foodsafetykorea.go.kr https://business.juso.go.kr https://api.vworld.kr; " +
          "img-src 'self' file: data:; " +
          "frame-src 'self'; " +  // SLS-1-20: Kakao 우편번호 iframe 도메인 제거
          "object-src 'none'; " +  // Flash, Java 등 플러그인 차단
          "base-uri 'self'; " +     // <base> 태그 제한
          "form-action 'self'; " +   // 폼 제출 대상 제한
          "frame-ancestors 'none'; " + // iframe 내 로드 방지
          "upgrade-insecure-requests;"  // HTTP를 HTTPS로 업그레이드
        ],
        // 추가 보안 헤더
        'X-Content-Type-Options': ['nosniff'],  // MIME 타입 스니핑 방지
        'X-Frame-Options': ['DENY'],  // 클릭재킹 방지
        'X-XSS-Protection': ['1; mode=block'],  // XSS 필터 활성화 (레거시 브라우저용)
        'Referrer-Policy': ['strict-origin-when-cross-origin'],  // Referrer 정보 제한
        'Permissions-Policy': [  // 브라우저 기능 제한
          "camera=(), " +
          "microphone=(), " +
          "geolocation=(), " +
          "payment=()"
        ]
      }
    });
  });

  // 한글 메뉴 적용
  const menu = Menu.buildFromTemplate(createMenuTemplate());
  Menu.setApplicationMenu(menu);

  createWindow();

  // 패키징된 앱에서만 자동 업데이트 체크
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  // macOS에서 dock 아이콘 클릭 시 창이 없으면 새로 생성
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ========================================
// 자동 업데이트 이벤트 핸들러
// ========================================

autoUpdater.on('checking-for-update', () => {
  console.log('업데이트 확인 중...');
});

autoUpdater.on('update-available', (info) => {
  console.log('업데이트 가능:', info.version);
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 발견',
    message: `새 버전(${info.version})이 있습니다.\n다운로드를 시작합니다.`,
    buttons: ['확인']
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('현재 최신 버전입니다:', info.version);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`다운로드 진행: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: '업데이트 준비 완료',
    message: `새 버전(${info.version})이 다운로드되었습니다.\n재시작하여 업데이트를 적용하시겠습니까?`,
    buttons: ['재시작', '나중에']
  }).then(result => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});

autoUpdater.on('error', (err) => {
  // 404 오류 (릴리스 파일 없음)는 무시 - macOS 빌드가 없을 때 발생
  if (err.message && err.message.includes('404')) {
    console.log('업데이트 파일 없음 (정상):', err.message);
    return;
  }
  console.error('업데이트 오류:', err);
});

// 모든 창이 닫히면 앱 종료 (macOS 제외)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ========================================
// 분석 팝업 윈도우 공통 헬퍼
// ========================================

/** 윈도우 참조 관리 맵 */
const analysisWindows = {};

/**
 * 분석 결과 팝업 윈도우 생성 헬퍼
 * @param {string} key - 윈도우 키 (예: 'heuktoram', 'waterAnalysis')
 * @param {Object} options - { title, width, height, minWidth, minHeight, subPath }
 */
async function openAnalysisPopup(key, options) {
    const existing = analysisWindows[key];
    if (existing && !existing.isDestroyed()) {
        existing.focus();
        return true;
    }

    const win = new BrowserWindow({
        width: options.width || 1400,
        height: options.height || 850,
        minWidth: options.minWidth || 1000,
        minHeight: options.minHeight || 600,
        title: options.title,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        },
    });

    analysisWindows[key] = win;
    win.on('closed', () => { analysisWindows[key] = null; });

    // 새 창 열기 차단 (외부 http(s)만 시스템 브라우저)
    win.webContents.setWindowOpenHandler(({ url }) => {
        try { const p = new URL(url).protocol; if (p === 'http:' || p === 'https:') shell.openExternal(url); } catch { /* invalid url → deny */ }
        return { action: 'deny' };
    });

    // 외부 URL 네비게이션 차단
    win.webContents.on('will-navigate', (event, url) => {
        if (url.startsWith('file://')) {
            try {
                const fileUrl = new URL(url);
                const filePath = decodeURIComponent(fileUrl.pathname);
                const normalizedPath = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath;
                let realFilePath;
                try { realFilePath = fs.realpathSync(normalizedPath); } catch { realFilePath = path.resolve(normalizedPath); }
                if (realFilePath.startsWith(DOCS_DIR + path.sep) || realFilePath === DOCS_DIR) return;
            } catch { /* 차단 */ }
            event.preventDefault();
            return;
        }
        if (url.startsWith('http://localhost:')) return;
        event.preventDefault();
    });

    // dev server / 빌드 파일 로드
    try {
        const http = require('node:http');
        await new Promise((resolve, reject) => {
            const req = http.get(VITE_DEV_SERVER_URL, { timeout: 1000 }, (res) => { res.destroy(); resolve(); });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
        win.loadURL(`${VITE_DEV_SERVER_URL}/${options.subPath}/`);
    } catch {
        const pagePath = path.join(__dirname, '..', 'docs', options.subPath, 'index.html');
        if (fs.existsSync(pagePath)) {
            win.loadFile(pagePath);
        } else {
            win.loadURL(`data:text/html;charset=utf-8,
                <h2 style="font-family:sans-serif;padding:2rem;">${options.title} 페이지를 찾을 수 없습니다</h2>
                <p style="font-family:sans-serif;padding:0 2rem;"><code>npm run build</code>로 빌드해주세요.</p>`);
        }
    }

    return true;
}

// ========================================
// 흙토람 팝업 윈도우
// ========================================

/** @type {Electron.BrowserWindow | null} */
let heuktoramWindow = null;

ipcMain.handle('open-heuktoram', async () => {
    // H-1: 기존 윈도우가 있으면 포커스만 (다중 생성 방지)
    if (heuktoramWindow && !heuktoramWindow.isDestroyed()) {
        heuktoramWindow.focus();
        return true;
    }

    heuktoramWindow = new BrowserWindow({
        width: 1400,
        height: 850,
        minWidth: 1000,
        minHeight: 600,
        title: '흙토람 내보내기',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        },
    });

    // H-1: 창 닫힘 시 참조 정리
    heuktoramWindow.on('closed', () => { heuktoramWindow = null; });

    // 새 창 열기 차단 (외부 http(s)만 시스템 브라우저)
    heuktoramWindow.webContents.setWindowOpenHandler(({ url }) => {
        try { const p = new URL(url).protocol; if (p === 'http:' || p === 'https:') shell.openExternal(url); } catch { /* invalid url → deny */ }
        return { action: 'deny' };
    });

    // M-3: 외부 URL 네비게이션 차단 (메인 윈도우와 동일)
    heuktoramWindow.webContents.on('will-navigate', (event, url) => {
        // M-3: file:// 프로토콜이고 실제 docs 디렉토리 내의 파일이면 허용
        if (url.startsWith('file://')) {
            try {
                const fileUrl = new URL(url);
                const filePath = decodeURIComponent(fileUrl.pathname);
                const normalizedPath = process.platform === 'win32' ? filePath.replace(/^\//, '') : filePath;
                let realFilePath;
                try {
                    realFilePath = fs.realpathSync(normalizedPath);
                } catch {
                    realFilePath = path.resolve(normalizedPath);
                }
                if (realFilePath.startsWith(DOCS_DIR + path.sep) || realFilePath === DOCS_DIR) {
                    return;
                }
            } catch {
                // 경로 파싱 실패 시 차단
            }
            event.preventDefault();
            return;
        }
        if (url.startsWith('http://localhost:')) return;
        event.preventDefault();
    });

    // 메인 윈도우와 동일한 로드 전략

    try {
        const http = require('node:http');
        await new Promise((resolve, reject) => {
            const req = http.get(VITE_DEV_SERVER_URL, { timeout: 1000 }, (res) => {
                res.destroy();
                resolve();
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
        heuktoramWindow.loadURL(`${VITE_DEV_SERVER_URL}/heuktoram/`);
    } catch {
        // H-3: 파일 없을 때 에러 안내 표시
        const heuktoramPath = path.join(__dirname, '..', 'docs', 'heuktoram', 'index.html');
        if (fs.existsSync(heuktoramPath)) {
            heuktoramWindow.loadFile(heuktoramPath);
        } else {
            heuktoramWindow.loadURL(`data:text/html;charset=utf-8,
                <h2 style="font-family:sans-serif;padding:2rem;">흙토람 페이지를 찾을 수 없습니다</h2>
                <p style="font-family:sans-serif;padding:0 2rem;">
                    <code>npm run build</code>로 빌드해주세요.
                </p>`);
        }
    }

    return true;
});

// ========================================
// 파일 시스템 IPC 핸들러
// ========================================

// 파일 저장 다이얼로그
ipcMain.handle('save-file-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: options.title || '파일 저장',
        defaultPath: options.defaultPath || '',
        filters: options.filters || [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    });

    if (!result.canceled && result.filePath) {
        return result.filePath;
    }
    return null;
});

// 파일 열기 다이얼로그
ipcMain.handle('open-file-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: options.title || '파일 열기',
        filters: options.filters || [
            { name: 'JSON Files', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        return result.filePaths[0];
    }
    return null;
});

// 파일 쓰기 (경로 검증 포함)
ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
        if (!ipcRateLimiter.check('write-file')) {
            return { success: false, error: '요청이 너무 빈번합니다. 잠시 후 다시 시도하세요.' };
        }
        // 경로 검증
        const validation = await validateFilePath(filePath);
        if (!validation.valid) {
            console.warn(`[보안] 파일 쓰기 거부: ${filePath} - ${validation.error}`);
            return { success: false, error: validation.error };
        }

        await fs.promises.writeFile(validation.resolvedPath, content, 'utf8');
        return { success: true };
    } catch (error) {
        console.error('[write-file] 오류:', error.message);
        return { success: false, error: '파일 저장 중 오류가 발생했습니다.' };
    }
});

// 파일 읽기 (경로 검증 포함)
ipcMain.handle('read-file', async (event, filePath) => {
    try {
        if (!ipcRateLimiter.check('read-file')) {
            return { success: false, error: '요청이 너무 빈번합니다. 잠시 후 다시 시도하세요.' };
        }
        // 경로 검증
        const validation = await validateFilePath(filePath);
        if (!validation.valid) {
            console.warn(`[보안] 파일 읽기 거부: ${filePath} - ${validation.error}`);
            return { success: false, error: validation.error };
        }

        // L-2: 파일 크기 제한 (50MB)
        const MAX_FILE_SIZE = 50 * 1024 * 1024;
        const stat = await fs.promises.stat(validation.resolvedPath);
        if (stat.size > MAX_FILE_SIZE) {
            return { success: false, error: `파일이 너무 큽니다 (최대 ${MAX_FILE_SIZE / 1024 / 1024}MB).` };
        }

        const content = await fs.promises.readFile(validation.resolvedPath, 'utf8');
        return { success: true, content };
    } catch (error) {
        console.error('[read-file] 오류:', error.message);
        return { success: false, error: '파일 읽기 중 오류가 발생했습니다.' };
    }
});

/**
 * @typedef {Object} Settings
 * @property {string} [autoSaveFolder] - 자동 저장 폴더 경로
 */

/**
 * 자동 저장 설정 파일 경로
 * @returns {string}
 */
function getSettingsPath() {
    return path.join(app.getPath('userData'), 'settings.json');
}

/**
 * 설정 로드
 * @returns {Settings}
 */
function loadSettings() {
    try {
        const settingsPath = getSettingsPath();
        if (fs.existsSync(settingsPath)) {
            // M-6: 파일 크기 제한 (10KB)
            const stat = fs.statSync(settingsPath);
            if (stat.size > 10240) {
                console.warn('[Settings] 설정 파일이 너무 큼:', stat.size);
                return {};
            }
            const data = fs.readFileSync(settingsPath, 'utf-8');
            const settings = JSON.parse(data);

            // M-6: 무결성 검증 — 허용된 키만 유지
            const ALLOWED_KEYS = ['autoSaveFolder', 'theme', 'itemsPerPage', 'firebaseConfig'];
            const validated = {};
            for (const key of ALLOWED_KEYS) {
                if (key in settings) {
                    validated[key] = settings[key];
                }
            }

            // autoSaveFolder 경로 검증
            if (validated.autoSaveFolder && typeof validated.autoSaveFolder === 'string') {
                if (validated.autoSaveFolder.includes('..') || validated.autoSaveFolder.includes('\0')) {
                    console.warn('[Settings] autoSaveFolder 경로 조작 감지:', validated.autoSaveFolder);
                    delete validated.autoSaveFolder;
                }
            }

            return validated;
        }
    } catch (error) {
        console.error('설정 로드 오류:', error);
    }
    return {};
}

/**
 * 설정 저장
 * @param {Settings} settings - 저장할 설정 객체
 * @returns {boolean}
 */
function saveSettings(settings) {
    try {
        const settingsPath = getSettingsPath();
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
        return true;
    } catch (error) {
        console.error('설정 저장 오류:', error);
        return false;
    }
}

// 자동 저장 경로 가져오기 (타입별, 연도별로 다른 파일명 사용)
ipcMain.handle('get-auto-save-path', async (event, type, year) => {
    // M-3: type/year 파라미터 검증
    const ALLOWED_TYPES = ['soil'];
    if (type && (typeof type !== 'string' || !ALLOWED_TYPES.includes(type))) {
        throw new Error(`허용되지 않는 시료 타입: ${type}`);
    }
    if (year && (typeof year !== 'number' && typeof year !== 'string' || !/^\d{4}$/.test(String(year)))) {
        throw new Error(`유효하지 않은 연도: ${year}`);
    }

    const settings = loadSettings();
    // 연도가 있으면 연도별 파일명 생성 (예: auto-save-heavy-metal-2025.json)
    let fileName;
    if (type && year) {
        fileName = `auto-save-${type}-${year}.json`;
    } else if (type) {
        fileName = `auto-save-${type}.json`;
    } else if (year) {
        fileName = `auto-save-${year}.json`;
    } else {
        fileName = 'auto-save.json';
    }

    if (settings.autoSaveFolder) {
        return path.join(settings.autoSaveFolder, fileName);
    }
    // 기본 경로
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, fileName);
});

// 자동 저장 폴더 선택
ipcMain.handle('select-auto-save-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: '자동 저장 폴더 선택',
        properties: ['openDirectory', 'createDirectory'],
        buttonLabel: '폴더 선택'
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    const selectedFolder = result.filePaths[0];
    const settings = loadSettings();
    settings.autoSaveFolder = selectedFolder;
    saveSettings(settings);

    // 선택한 폴더 경로와 전체 경로 모두 반환
    const defaultFileName = 'auto-save.json';
    return {
        success: true,
        folder: selectedFolder,
        path: path.join(selectedFolder, defaultFileName)
    };
});

// 현재 자동 저장 폴더 가져오기
ipcMain.handle('get-auto-save-folder', async () => {
    const settings = loadSettings();
    return settings.autoSaveFolder || app.getPath('userData');
});

// 앱 데이터 경로 가져오기
ipcMain.handle('get-app-path', async () => {
    return app.getPath('userData');
});

// 앱 버전 가져오기
ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

// ========================================
// Firebase 인증 파일 IPC 핸들러
// ========================================

/**
 * Firebase 인증 파일 경로
 * @returns {string}
 */
function getAuthFilePath() {
    return path.join(app.getPath('userData'), 'firebase-auth.json');
}

// 인증 파일 읽기
ipcMain.handle('read-auth-file', async () => {
    try {
        const authFilePath = getAuthFilePath();

        if (!fs.existsSync(authFilePath)) {
            return { exists: false };
        }

        const content = fs.readFileSync(authFilePath, 'utf8');
        return { exists: true, content };
    } catch (error) {
        console.error('[AuthFile] 읽기 오류:', error);
        return { exists: false, error: '인증 파일 읽기 중 오류가 발생했습니다.' };
    }
});

// 인증 파일 저장 (메인 프로세스에서도 검증 - defense-in-depth)
ipcMain.handle('save-auth-file', async (event, content) => {
    try {
        // 크기 제한 (10KB)
        if (!content || typeof content !== 'string' || content.length > 10240) {
            return { success: false, error: '유효하지 않은 내용입니다 (최대 10KB).' };
        }

        // JSON 및 필수 필드 검증
        let config;
        try {
            config = JSON.parse(content);
        } catch {
            return { success: false, error: '유효한 JSON 형식이 아닙니다.' };
        }
        if (!config.apiKey || !config.projectId) {
            return { success: false, error: 'apiKey와 projectId가 필요합니다.' };
        }

        const authFilePath = getAuthFilePath();

        // 경로 검증 추가 (defense-in-depth)
        const validation = await validateFilePath(authFilePath);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        fs.writeFileSync(authFilePath, content, { encoding: 'utf8', mode: 0o600 });
        console.log('[AuthFile] 저장 완료:', authFilePath);
        return { success: true };
    } catch (error) {
        console.error('[AuthFile] 저장 오류:', error);
        return { success: false, error: '인증 파일 저장 중 오류가 발생했습니다.' };
    }
});

// 인증 파일 삭제
ipcMain.handle('delete-auth-file', async () => {
    try {
        const authFilePath = getAuthFilePath();

        if (fs.existsSync(authFilePath)) {
            fs.unlinkSync(authFilePath);
            console.log('[AuthFile] 삭제 완료:', authFilePath);
        }

        return { success: true };
    } catch (error) {
        console.error('[AuthFile] 삭제 오류:', error);
        return { success: false, error: '인증 파일 삭제 중 오류가 발생했습니다.' };
    }
});

// 인증 파일 존재 여부 확인
ipcMain.handle('check-auth-file', async () => {
    try {
        const authFilePath = getAuthFilePath();
        const exists = fs.existsSync(authFilePath);
        return { exists };
    } catch (error) {
        console.error('[AuthFile] 확인 오류:', error);
        return { exists: false, error: '인증 파일 확인 중 오류가 발생했습니다.' };
    }
});

// 인증 파일 선택 다이얼로그 (Electron 네이티브)
ipcMain.handle('select-auth-file', async () => {
    try {
        // 기본 경로: 앱 실행 디렉토리 (프로젝트 루트)
        const defaultPath = process.cwd();
        console.log('[AuthFile] 파일 선택 다이얼로그 열림, 기본 경로:', defaultPath);

        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Firebase 인증 파일 선택 (firebase-auth.json)',
            defaultPath: defaultPath,
            buttonLabel: '선택',
            filters: [
                { name: 'JSON 파일', extensions: ['json'] },
                { name: '모든 파일', extensions: ['*'] }
            ],
            properties: ['openFile']
        });

        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }

        // 선택한 파일 읽기 (크기 제한: 10KB - 인증 파일은 1KB 미만이어야 정상)
        const selectedPath = result.filePaths[0];
        const stat = fs.statSync(selectedPath);
        if (stat.size > 10240) {
            return { success: false, error: '파일이 너무 큽니다 (최대 10KB). 올바른 인증 파일인지 확인하세요.' };
        }
        // 선택된 파일 경로 검증
        const pathValidation = await validateFilePath(selectedPath);
        if (!pathValidation.valid) {
            return { success: false, error: pathValidation.error };
        }

        const content = fs.readFileSync(selectedPath, 'utf8');

        // JSON 유효성 검사
        try {
            const config = JSON.parse(content);
            if (!config.apiKey || !config.projectId) {
                return { success: false, error: '유효하지 않은 인증 파일입니다. apiKey와 projectId가 필요합니다.' };
            }

            // 인증 파일로 저장
            const authFilePath = getAuthFilePath();
            fs.writeFileSync(authFilePath, content, { encoding: 'utf8', mode: 0o600 });
            console.log('[AuthFile] 선택 및 저장 완료:', authFilePath);

            return { success: true, projectId: config.projectId };
        } catch (parseError) {
            return { success: false, error: '파일이 올바른 JSON 형식이 아닙니다.' };
        }
    } catch (error) {
        console.error('[AuthFile] 선택 오류:', error);
        return { success: false, error: '인증 파일 선택 중 오류가 발생했습니다.' };
    }
});

// ========================================
// JUSO(도로명주소) API 검색 (main process에서 직접 호출)
// 차용: postal-code-finder (MIT) backend/src/services/providers/jusoPostalCodeService.js
//       backend/src/routes/address.js (sanitizeKeyword)
// ========================================

const JUSO_SQL_RESERVED = [
    'OR', 'SELECT', 'INSERT', 'DELETE', 'UPDATE',
    'CREATE', 'DROP', 'EXEC', 'UNION', 'FETCH',
    'DECLARE', 'TRUNCATE'
];
const JUSO_BAD_CHARS = /[<>=%]/;

/**
 * JUSO 검색어 sanitize (postal-code-finder routes/address.js 차용)
 * @param {string} q
 * @returns {{ok: boolean, value?: string, error?: string}}
 */
// SLS-1-20: defense-in-depth 의도적 중복.
//   shared 카운터파트: src/shared/juso-service.js (sanitizeKeyword)
//   양쪽 sync 필수 — SQL_RESERVED/BAD_CHARS 변경 시 두 파일 동시 수정
//   main이 신뢰 경계 (renderer 우회 가능성 차단)
// SLS-1-20 L-2: 정규식 사전 컴파일 (호출당 RegExp 12회 생성 방지)
const JUSO_SQL_PATTERNS = JUSO_SQL_RESERVED.map(w => ({ word: w, re: new RegExp(`\\b${w}\\b`, 'i') }));
function sanitizeJusoKeyword(q) {
    const s = String(q || '').trim();
    if (!s) return { ok: false, error: '검색어를 입력해 주세요.' };
    if (s.length > 80) return { ok: false, error: '검색어가 너무 깁니다 (최대 80자).' };
    if (JUSO_BAD_CHARS.test(s)) {
        return { ok: false, error: '<, >, =, % 문자는 사용할 수 없습니다.' };
    }
    for (const { word, re } of JUSO_SQL_PATTERNS) {
        if (re.test(s)) return { ok: false, error: `"${word}" 같은 예약어는 사용할 수 없습니다.` };
    }
    return { ok: true, value: s };
}

// 외부 API 호출 채널은 초당 5회로 더 엄격하게 제한
// (사용자 키 보호 + 서비스 약관 준수)
const EXT_API_MAX_CALLS_PER_SEC = 5;

ipcMain.handle('juso:search', async (_event, payload) => {
    if (!ipcRateLimiter.check('juso:search', EXT_API_MAX_CALLS_PER_SEC)) {
        return { ok: false, error: '요청이 너무 빈번합니다. 잠시 후 다시 시도하세요.' };
    }

    // 입력 검증
    if (!payload || typeof payload !== 'object') {
        return { ok: false, error: '유효하지 않은 요청입니다.' };
    }
    const { keyword, page = 1, size = 10 } = payload;

    const chk = sanitizeJusoKeyword(keyword);
    if (!chk.ok) return { ok: false, error: chk.error };

    const pageNum = Math.max(1, Math.min(100, Number(page) || 1));
    const sizeNum = Math.max(1, Math.min(50, Number(size) || 10));

    const apiKey = process.env.JUSO_API_KEY || process.env.JUSO_KEY;
    if (!apiKey) {
        return { ok: false, error: 'JUSO_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.' };
    }

    const https = require('node:https');
    // firstSort=road는 같은 도로명의 다수 지번을 인접 배치하여 행정구역 다양성을 떨어뜨림.
    // 자동완성 UX에서는 다양한 시·군이 빠르게 노출되는 게 중요하므로 미지정(기본 정렬) 사용.
    const params = new URLSearchParams({
        confmKey: apiKey,
        currentPage: String(pageNum),
        countPerPage: String(sizeNum),
        keyword: chk.value,
        resultType: 'json',
        hstryYn: 'N'
    });
    const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?${params.toString()}`;
    const MAX_RESPONSE_SIZE = 256 * 1024; // 256KB

    return new Promise((resolve) => {
        // Buffer 누적 방식: 청크 경계에서 UTF-8 다중바이트(한글 3B)가 잘려도 안전하게 디코드
        const chunks = [];
        let totalSize = 0;
        let aborted = false;
        let timeout = null;
        const finish = (result) => {
            if (aborted) return;
            aborted = true;
            if (timeout) clearTimeout(timeout);
            resolve(result);
        };
        const req = https.get(url, (res) => {
            // HTTP 상태 코드 검증 (200~299 범위만 허용)
            // - 4xx/5xx: API 키 오류, 점검, 서버 오류 등 -> body가 JSON이 아닐 수 있음
            // - 3xx: Node https.get은 자동 리다이렉트 미지원 -> body가 비어있거나 HTML
            const status = res.statusCode || 0;
            if (status < 200 || status >= 300) {
                req.destroy();
                return finish({
                    ok: false,
                    error: `JUSO HTTP ${status} 오류 (점검 중이거나 API 키를 확인하세요).`
                });
            }
            // setEncoding 호출하지 않음: 자동 string 변환은 청크 경계에서 다중바이트 잘림 시
            // replacement character(U+FFFD)를 삽입할 수 있어 한글이 깨질 가능성이 있음.
            res.on('data', (chunk) => {
                if (aborted) return;
                chunks.push(chunk);
                totalSize += chunk.length;
                if (totalSize > MAX_RESPONSE_SIZE) {
                    req.destroy();
                    finish({ ok: false, error: 'JUSO 응답이 너무 큽니다.' });
                }
            });
            res.on('end', () => {
                if (aborted) return;
                try {
                    // Buffer.concat으로 모든 청크 합친 후 한 번에 UTF-8 디코드 → 청크 경계 무관
                    const data = Buffer.concat(chunks).toString('utf8');
                    const json = JSON.parse(data);
                    const results = json?.results;
                    if (!results) {
                        return finish({ ok: false, error: 'JUSO 응답 형식 오류' });
                    }
                    const common = results.common || {};
                    if (common.errorCode && common.errorCode !== '0') {
                        return finish({
                            ok: false,
                            error: `JUSO ${common.errorCode}: ${common.errorMessage || ''}`.trim()
                        });
                    }
                    const items = Array.isArray(results.juso) ? results.juso : [];
                    finish({
                        ok: true,
                        total: Number(common.totalCount || items.length || 0),
                        page: Number(common.currentPage || pageNum),
                        size: Number(common.countPerPage || sizeNum),
                        items
                    });
                } catch (e) {
                    finish({ ok: false, error: 'JUSO 응답 파싱 오류' });
                }
            });
        });
        timeout = setTimeout(() => {
            req.destroy();
            finish({ ok: false, error: 'JUSO 호출 시간 초과 (8초).' });
        }, 8000);
        req.on('error', (err) => {
            console.error('[juso:search] 네트워크 오류:', err?.message);
            finish({ ok: false, error: 'JUSO 네트워크 오류' });
        });
    });
});

// VWORLD 지번 지오코딩 (main process → Origin 헤더 없음, 도메인 제한 우회)
// 보안: apiKey는 main process의 process.env.VWORLD_API_KEY에서 직접 참조 (렌더러 노출 없음)
ipcMain.handle('vworld-geocode', async (event, { address }) => {
    if (!ipcRateLimiter.check('vworld-geocode', EXT_API_MAX_CALLS_PER_SEC)) {
        return null;
    }
    if (typeof address !== 'string' || address.length === 0 || address.length > 200) {
        return null;
    }
    const apiKey = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY;
    if (!apiKey) {
        console.error('[vworld-geocode] VWORLD_API_KEY가 설정되지 않았습니다.');
        return null;
    }

    const https = require('node:https');
    const url = `https://api.vworld.kr/req/address?service=address&request=getCoord&version=2.0&crs=epsg:4326&address=${encodeURIComponent(address)}&refine=true&simple=false&format=json&type=parcel&key=${apiKey}`;
    const MAX_RESPONSE_SIZE = 100 * 1024; // 100KB
    return new Promise((resolve) => {
        // Buffer 누적: 청크 경계 UTF-8 다중바이트 잘림 방어 (한글 응답 안전)
        const chunks = [];
        let totalSize = 0;
        let aborted = false;
        let timeout = null;
        const finish = (value) => {
            if (aborted) return;
            aborted = true;
            if (timeout) clearTimeout(timeout);
            resolve(value);
        };
        const req = https.get(url, (res) => {
            // HTTP 상태 코드 검증 (200~299만 허용)
            const status = res.statusCode || 0;
            if (status < 200 || status >= 300) {
                req.destroy();
                return finish(null);
            }
            res.on('data', chunk => {
                if (aborted) return;
                chunks.push(chunk);
                totalSize += chunk.length;
                if (totalSize > MAX_RESPONSE_SIZE) {
                    req.destroy();
                    finish(null);
                }
            });
            res.on('end', () => {
                if (aborted) return;
                try {
                    const data = Buffer.concat(chunks).toString('utf8');
                    const json = JSON.parse(data);
                    const ok = json?.response?.status === 'OK';
                    finish(ok);
                } catch { finish(null); }
            });
        });
        timeout = setTimeout(() => { req.destroy(); finish(null); }, 8000);
        req.on('error', () => { finish(null); });
    });
});
