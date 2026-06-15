/**
 * @fileoverview Electron Preload 스크립트
 * @description 렌더러 프로세스에 안전한 API 노출 (Context Isolation)
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * @typedef {Object} SaveDialogOptions
 * @property {string} [title] - 다이얼로그 제목
 * @property {string} [defaultPath] - 기본 경로
 * @property {Array<{name: string, extensions: string[]}>} [filters] - 파일 필터
 */

/**
 * @typedef {Object} OpenDialogOptions
 * @property {string} [title] - 다이얼로그 제목
 * @property {Array<{name: string, extensions: string[]}>} [filters] - 파일 필터
 */

/**
 * @typedef {Object} WriteResult
 * @property {boolean} success - 성공 여부
 * @property {string} [error] - 에러 메시지
 */

/**
 * @typedef {Object} ReadResult
 * @property {boolean} success - 성공 여부
 * @property {string} [content] - 파일 내용
 * @property {string} [error] - 에러 메시지
 */

/**
 * @typedef {Object} SelectFolderResult
 * @property {boolean} success - 성공 여부
 * @property {boolean} [canceled] - 취소 여부
 * @property {string} [folder] - 선택된 폴더 경로
 * @property {string} [path] - 전체 파일 경로
 */

// 렌더러 프로세스에 안전하게 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
    // 파일 저장 다이얼로그
    saveFileDialog: (options) => ipcRenderer.invoke('save-file-dialog', options),

    // 파일 열기 다이얼로그
    openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

    // 파일 쓰기
    writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

    // 파일 읽기
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

    // 자동 저장 경로 가져오기 (타입별, 연도별로 다른 파일명 사용)
    getAutoSavePath: (type, year) => ipcRenderer.invoke('get-auto-save-path', type, year),

    // 자동 저장 폴더 선택
    selectAutoSaveFolder: () => ipcRenderer.invoke('select-auto-save-folder'),

    // 현재 자동 저장 폴더 가져오기
    getAutoSaveFolder: () => ipcRenderer.invoke('get-auto-save-folder'),

    // 앱 데이터 경로 가져오기
    getAppPath: () => ipcRenderer.invoke('get-app-path'),

    // 앱 버전 가져오기
    getVersion: () => ipcRenderer.invoke('get-app-version'),

    // ========================================
    // Firebase 인증 파일 관련
    // ========================================

    // 인증 파일 읽기
    readAuthFile: () => ipcRenderer.invoke('read-auth-file'),

    // 게시판 전용 Firebase 설정 읽기 (SLS-1-151, 렌더러 번들에 키 미포함)
    readFeedbackConfig: () => ipcRenderer.invoke('read-feedback-config'),

    // 인증 파일 저장
    saveAuthFile: (content) => ipcRenderer.invoke('save-auth-file', content),

    // 인증 파일 삭제
    deleteAuthFile: () => ipcRenderer.invoke('delete-auth-file'),

    // 인증 파일 존재 여부 확인
    checkAuthFile: () => ipcRenderer.invoke('check-auth-file'),

    // 인증 파일 선택 다이얼로그 (Electron 네이티브)
    selectAuthFile: () => ipcRenderer.invoke('select-auth-file'),

    // 흙토람 팝업 윈도우 열기
    openHeuktoram: () => ipcRenderer.invoke('open-heuktoram'),

    // VWORLD 지번 지오코딩 (main에서 process.env.VWORLD_API_KEY 사용; 렌더러 키 노출 없음)
    vworldGeocode: (address) => ipcRenderer.invoke('vworld-geocode', { address }),

    // JUSO(도로명주소) API 검색 (main process 경유, 키 노출 없음)
    // payload: { keyword: string, page?: number, size?: number }
    // 반환: { ok: boolean, items?: Array, total?: number, error?: string }
    jusoSearch: (payload) => ipcRenderer.invoke('juso:search', payload),

    // Electron 환경 여부
    isElectron: true
});
