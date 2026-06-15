// ========================================
// 게시판 전용 Firebase 연결 (named app: 'feedbackApp') — SLS-1-150, SLS-1-151
// ----------------------------------------
// 시료 데이터용 firebaseConfig(기본 앱)와 완전히 독립된 별도 Firebase 앱을 쓴다.
//
// 키 비공개 정책 (SLS-1-151):
//   게시판 키는 렌더러 번들(docs/ = GitHub Pages 공개)에 절대 넣지 않는다.
//   대신 Electron이 런타임에 feedback-auth.json을 IPC로 읽어 설정을 주입한다.
//   → 웹(electronAPI 없음)에서는 설정이 없어 게시판이 로컬 모드로 동작한다(데스크톱 전용).
//   → 키는 관리자만 보유(GitHub Secrets → 빌드 시 동봉), 공개 저장소엔 미포함.
// ========================================
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const APP_NAME = 'feedbackApp';

// 모듈 전역 상태. 전제: "페이지당 단일 역할" — 보드 페이지는 익명, 관리자 페이지는
// 이메일 로그인만 쓴다(별도 HTML/엔트리). 한 페이지에서 두 역할을 혼용하지 않는다.
let db = null;
let auth = null;
let enabled = false;
let uid = null;
let loadedConfig = null; // 마지막으로 로드한 feedback-auth.json (알림 설정 등 노출용)

/** config가 실제 값으로 채워졌는지 (placeholder/빈값이면 미설정으로 간주) */
function isConfigValid(c) {
    return !!(c
        && typeof c.apiKey === 'string'
        && c.apiKey.trim() !== ''
        && c.apiKey !== 'PASTE_FEEDBACK_PROJECT_API_KEY_HERE'
        && c.projectId
        && String(c.projectId).trim() !== '');
}

/**
 * 게시판 Firebase 설정을 Electron 런타임 파일에서 로드.
 * 웹(electronAPI 없음)이거나 파일이 없으면 null → 로컬 모드.
 * @returns {Promise<Object|null>}
 */
async function loadConfig() {
    if (!window.electronAPI?.readFeedbackConfig) {
        return null; // 웹 환경 — 게시판은 데스크톱 전용
    }
    try {
        const result = await window.electronAPI.readFeedbackConfig();
        if (!result?.exists || !result.content) return null;
        // 선행 BOM 제거 (관리자가 메모장 등으로 BOM 포함 저장 시 JSON.parse 실패 방어)
        return JSON.parse(result.content.replace(/^﻿/, ''));
    } catch (e) {
        (window.logger?.error || console.error)('[feedback-fb] 설정 파일 파싱 실패:', e);
        return null;
    }
}

/**
 * named app 초기화(설정 로드 + initializeApp + db/auth 준비). 인증은 하지 않는다.
 * 보드(익명)·관리자(이메일) 로그인이 공유한다.
 * @returns {Promise<boolean>} 설정이 유효하고 앱이 준비되면 true
 */
async function _ensureApp() {
    if (db && auth) return true;
    const config = await loadConfig();
    if (!isConfigValid(config)) {
        (window.logger?.info || console.info)('[feedback-fb] 게시판 설정 없음(웹/미동봉) — 로컬 모드로 동작');
        return false;
    }
    if (!navigator.onLine) {
        (window.logger?.info || console.info)('[feedback-fb] 오프라인 — 로컬 모드로 동작');
        return false;
    }
    loadedConfig = config; // 알림 설정(notify) 노출용으로 보관
    // 이미 만들어진 named app이 있으면 재사용 (중복 initializeApp 방지)
    const existing = firebase.apps.find((a) => a.name === APP_NAME);
    const app = existing || firebase.initializeApp(config, APP_NAME);
    db = app.firestore();
    auth = app.auth();
    return true;
}

/**
 * 보드용 초기화 + 익명 인증. 설정 없음/오프라인/실패면 false → 로컬 폴백.
 * @returns {Promise<boolean>}
 */
async function initialize() {
    if (enabled && db && uid) return true;
    if (!(await _ensureApp())) return false;
    try {
        const cred = await auth.signInAnonymously();
        uid = cred.user?.uid || null;
        enabled = true;
        (window.logger?.info || console.info)('[feedback-fb] 게시판 Firebase 연결됨:', loadedConfig?.projectId);
        return true;
    } catch (e) {
        if (e?.code === 'auth/operation-not-allowed') {
            (window.logger?.error || console.error)('[feedback-fb] 익명 인증이 비활성화되어 있습니다. Firebase 콘솔 > Authentication > Sign-in method에서 익명(Anonymous)을 활성화하세요.');
        } else {
            (window.logger?.error || console.error)('[feedback-fb] 게시판 Firebase 초기화 실패:', e);
        }
        enabled = false; uid = null;
        return false;
    }
}

/**
 * 관리자 이메일/비밀번호 로그인 (관리자 페이지 전용 — SLS-1-154).
 * @returns {Promise<{ok:boolean, uid?:string, error?:string}>}
 */
async function signInAdmin(email, password) {
    if (!(await _ensureApp())) {
        return { ok: false, error: '게시판 설정이 없습니다. 데스크톱 앱에서 실행하세요.' };
    }
    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        uid = cred.user?.uid || null;
        enabled = true;
        return { ok: true, uid };
    } catch (e) {
        let msg = '로그인에 실패했습니다.';
        const code = e?.code || '';
        if (code === 'auth/operation-not-allowed') msg = '이메일/비밀번호 인증이 비활성화되어 있습니다. Firebase 콘솔 > Authentication에서 활성화하세요.';
        else if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) msg = '이메일 또는 비밀번호가 올바르지 않습니다.';
        else if (code === 'auth/invalid-email') msg = '이메일 형식이 올바르지 않습니다.';
        else if (code === 'auth/too-many-requests') msg = '시도가 너무 많습니다. 잠시 후 다시 시도하세요.';
        (window.logger?.warn || console.warn)('[feedback-fb] 관리자 로그인 실패:', code || e);
        return { ok: false, error: msg };
    }
}

/** 관리자 로그아웃 */
async function signOutAdmin() {
    try { await auth?.signOut(); } catch (_) { /* noop */ }
    enabled = false;
    uid = null;
}

// 전역 노출
window.feedbackFirebase = {
    initialize,
    signInAdmin,
    signOutAdmin,
    getDb: () => db,
    getUid: () => uid || auth?.currentUser?.uid || null,
    isEnabled: () => enabled,
    // 새 문의 알림 설정(notify 블록) 반환 — feedback-notify.js가 사용 (SLS-1-153)
    getNotifyConfig: () => loadedConfig?.notify || null
};
