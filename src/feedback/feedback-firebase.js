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

let db = null;
let auth = null;
let enabled = false;
let uid = null;

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
 * 게시판 Firebase 초기화 + 익명 인증.
 * 설정 없음/오프라인/실패면 false 반환 → 호출부가 로컬 폴백.
 * @returns {Promise<boolean>}
 */
async function initialize() {
    if (enabled && db) return true;

    const config = await loadConfig();
    if (!isConfigValid(config)) {
        (window.logger?.info || console.info)('[feedback-fb] 게시판 설정 없음(웹/미동봉) — 로컬 모드로 동작');
        return false;
    }
    if (!navigator.onLine) {
        (window.logger?.info || console.info)('[feedback-fb] 오프라인 — 로컬 모드로 동작');
        return false;
    }

    try {
        // 이미 만들어진 named app이 있으면 재사용 (중복 initializeApp 방지)
        const existing = firebase.apps.find((a) => a.name === APP_NAME);
        const app = existing || firebase.initializeApp(config, APP_NAME);

        db = app.firestore();
        auth = app.auth();

        const cred = await auth.signInAnonymously();
        uid = cred.user?.uid || null;
        enabled = true;
        (window.logger?.info || console.info)('[feedback-fb] 게시판 Firebase 연결됨:', config.projectId);
        return true;
    } catch (e) {
        if (e?.code === 'auth/operation-not-allowed') {
            (window.logger?.error || console.error)('[feedback-fb] 익명 인증이 비활성화되어 있습니다. Firebase 콘솔 > Authentication > Sign-in method에서 익명(Anonymous)을 활성화하세요.');
        } else {
            (window.logger?.error || console.error)('[feedback-fb] 게시판 Firebase 초기화 실패:', e);
        }
        enabled = false;
        db = null;
        auth = null;
        uid = null;
        return false;
    }
}

// 전역 노출 (FirestoreFeedbackStore가 사용)
window.feedbackFirebase = {
    initialize,
    getDb: () => db,
    getUid: () => uid || auth?.currentUser?.uid || null,
    isEnabled: () => enabled
};
