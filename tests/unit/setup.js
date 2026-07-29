// jsdom 전역 목(mock) 설정 — 실제 모듈 import 전 실행됨

// DOMPurify mock (sanitize.js가 선택적으로 사용)
global.DOMPurify = {
    sanitize: (html) => html
}

// logger mock
global.window.logger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {}
}

// firebase 관련 — 비활성화 상태
global.window.firebaseConfig = { isEnabled: () => false }
global.window.firestoreDb = { isEnabled: () => false }

// SyncUtils — 없으면 BaseSampleManager 폴백 로직 사용
global.window.SyncUtils = undefined

// localStorage Map 기반 mock (jsdom의 localStorage가 clear()를 지원하지 않을 수 있음)
const _store = new Map()
global.localStorage = {
    getItem: (k) => _store.has(k) ? _store.get(k) : null,
    setItem: (k, v) => _store.set(k, String(v)),
    removeItem: (k) => _store.delete(k),
    clear: () => _store.clear(),
    get length() { return _store.size },
    // 실제 Storage 인터페이스의 일부인데 빠져 있었다 (SLS-1-217).
    // cache-manager.js가 length/key(i)로 키를 훑으므로 없으면 TypeError로 죽는다.
    key: (i) => [..._store.keys()][i] ?? null
}
