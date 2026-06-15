// ========================================
// 문의/공지 게시판 저장소 어댑터 (SLS-1-148)
// ----------------------------------------
// 추상 인터페이스(FeedbackStore)를 두고, 현재는 localStorage 구현
// (LocalFeedbackStore)을 사용한다. 추후 Firestore 연결 시
// FirestoreFeedbackStore로 무손실 교체할 수 있도록 모든 메서드를
// async(Promise 반환)로 설계했다. (file-api.js / storage-manager.js의
// 환경 추상화 패턴과 동일한 컨벤션.)
// ========================================

const FEEDBACK_INQUIRY_KEY = 'soilFeedbackInquiries';
const FEEDBACK_NOTICE_KEY = 'soilFeedbackNotices';

/** 문의 유형 옵션 */
const FEEDBACK_TYPES = ['버그·오류 신고', '기능 건의', '사용 문의', '기타'];

/** 문의 처리 상태 */
const FEEDBACK_STATUS = {
    RECEIVED: '접수',
    IN_PROGRESS: '처리중',
    DONE: '완료'
};

/**
 * 게시판 저장소 추상 인터페이스.
 * 구현체는 아래 메서드를 모두 Promise로 반환해야 한다.
 *
 * 레코드 형태:
 *   공지(notice):  { id, title, body, createdAt }
 *   문의(inquiry): { id, org, type, title, body, contact, status, reply, createdAt }
 */
class FeedbackStore {
    /** @returns {Promise<Array>} 공지 목록 (최신순) */
    async listNotices() { throw new Error('Not implemented'); }

    /** @returns {Promise<Array>} 문의 목록 (최신순) */
    async listInquiries() { throw new Error('Not implemented'); }

    /**
     * 문의 등록
     * @param {{org?:string, type:string, title:string, body:string, contact?:string}} data
     * @returns {Promise<Object>} 생성된 문의 레코드
     */
    async addInquiry(_data) { throw new Error('Not implemented'); }

    /**
     * 문의 삭제 (작성자 본인 철회)
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async deleteInquiry(_id) { throw new Error('Not implemented'); }

    /**
     * 이 저장소가 다중 사용자 동기화(클라우드)를 지원하는지 여부.
     * UI에서 "이 기기에만 저장됨" 안내를 띄울지 판단하는 데 사용.
     * @returns {boolean}
     */
    get isShared() { return false; }
}

/**
 * localStorage 기반 구현. 글은 작성한 기기에만 저장된다.
 * (관리자에게 전달되지 않으므로 UI에서 안내 문구를 노출한다.)
 */
class LocalFeedbackStore extends FeedbackStore {
    _read(key) {
        try {
            const raw = localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            (window.logger?.warn || console.warn)('[feedback] 저장소 읽기 실패:', e);
            return [];
        }
    }

    _write(key, list) {
        try {
            localStorage.setItem(key, JSON.stringify(list));
        } catch (e) {
            // QuotaExceeded / 프라이빗 모드 등 쓰기 실패를 호출부가 인지하도록 래핑
            (window.logger?.error || console.error)('[feedback] 저장소 쓰기 실패:', e);
            throw new Error('저장 공간이 부족하거나 저장에 실패했습니다.');
        }
    }

    _genId() {
        return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    }

    async listNotices() {
        return this._read(FEEDBACK_NOTICE_KEY)
            .slice()
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    async listInquiries() {
        return this._read(FEEDBACK_INQUIRY_KEY)
            .slice()
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    async addInquiry(data) {
        const list = this._read(FEEDBACK_INQUIRY_KEY);
        const record = {
            id: this._genId(),
            org: (data.org || '').trim(),
            type: data.type || FEEDBACK_TYPES[2],
            title: (data.title || '').trim(),
            body: (data.body || '').trim(),
            contact: (data.contact || '').trim(),
            status: FEEDBACK_STATUS.RECEIVED,
            reply: '',
            createdAt: new Date().toISOString()
        };
        list.push(record);
        this._write(FEEDBACK_INQUIRY_KEY, list);
        return record;
    }

    async deleteInquiry(id) {
        const list = this._read(FEEDBACK_INQUIRY_KEY);
        const next = list.filter(r => r.id !== id);
        this._write(FEEDBACK_INQUIRY_KEY, next);
        return next.length !== list.length;
    }
}

/** Firestore 컬렉션 이름 */
const FEEDBACK_INQUIRY_COLLECTION = 'feedbackInquiries';
const FEEDBACK_NOTICE_COLLECTION = 'feedbackNotices';

/**
 * Firestore 기반 구현 (SLS-1-149, SLS-1-150).
 * 게시판 전용 Firebase(window.feedbackFirebase, named app 'feedbackApp')의
 * 익명 인증 + getDb()를 사용한다. 시료 데이터용 firebaseConfig와는 독립이다.
 *
 * 데이터 모델 (익명 인증이라 Firebase에 '관리자' 역할이 없음):
 *  - feedbackInquiries: 익명 ownerUid 기준 본인 글만 생성/조회/삭제 (1:1 문의함).
 *    답변(reply)·상태(status)는 관리자가 Firebase 콘솔에서 직접 수정 (콘솔은 보안규칙 우회).
 *  - feedbackNotices: 앱은 읽기 전용. 공지는 관리자가 Firebase 콘솔에서 작성.
 *
 * 보안 규칙은 프로젝트 루트 firestore.rules 참고.
 */
class FirestoreFeedbackStore extends FeedbackStore {
    get isShared() { return true; }

    _db() {
        const db = window.feedbackFirebase?.getDb?.();
        if (!db) throw new Error('게시판이 클라우드에 연결되지 않았습니다.');
        return db;
    }

    _uid() {
        return window.feedbackFirebase?.getUid?.() || null;
    }

    async listNotices() {
        try {
            const snap = await this._db().collection(FEEDBACK_NOTICE_COLLECTION).get();
            const list = [];
            snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (e) {
            (window.logger?.error || console.error)('[feedback] 공지 조회 실패:', e);
            return [];
        }
    }

    async listInquiries() {
        const uid = this._uid();
        if (!uid) return []; // 익명 인증 전이면 조회 불가 (보안 규칙상 본인 글만 읽기 가능)
        try {
            const snap = await this._db()
                .collection(FEEDBACK_INQUIRY_COLLECTION)
                .where('ownerUid', '==', uid)
                .get();
            const list = [];
            snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
            return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        } catch (e) {
            (window.logger?.error || console.error)('[feedback] 문의 조회 실패:', e);
            return [];
        }
    }

    async addInquiry(data) {
        const uid = this._uid();
        if (!uid) throw new Error('연결 인증이 완료되지 않았습니다. 잠시 후 다시 시도해주세요.');
        const record = {
            ownerUid: uid,
            org: (data.org || '').trim(),
            type: data.type || FEEDBACK_TYPES[2],
            title: (data.title || '').trim(),
            body: (data.body || '').trim(),
            contact: (data.contact || '').trim(),
            status: FEEDBACK_STATUS.RECEIVED,
            reply: '',
            createdAt: new Date().toISOString()
        };
        try {
            const ref = await this._db().collection(FEEDBACK_INQUIRY_COLLECTION).add(record);
            return { id: ref.id, ...record };
        } catch (e) {
            (window.logger?.error || console.error)('[feedback] 문의 등록 실패:', e);
            throw new Error('문의 등록에 실패했습니다. 네트워크 상태를 확인해주세요.');
        }
    }

    async deleteInquiry(id) {
        if (!id) return false;
        try {
            await this._db().collection(FEEDBACK_INQUIRY_COLLECTION).doc(id).delete();
            return true;
        } catch (e) {
            (window.logger?.error || console.error)('[feedback] 문의 삭제 실패:', e);
            throw new Error('삭제에 실패했습니다. 네트워크 상태를 확인해주세요.');
        }
    }
}

/**
 * 환경에 맞는 저장소 구현을 반환하는 팩토리.
 * 현재는 항상 LocalFeedbackStore. 추후 Firestore 활성화 시 분기 추가.
 * @returns {FeedbackStore}
 */
function createFeedbackStore() {
    // 게시판 전용 Firebase(feedbackFirebase)가 활성화돼 있으면 Firestore, 아니면 로컬 폴백.
    // 시료 데이터용 firebaseConfig와는 무관 — 게시판은 독립된 공유 프로젝트를 쓴다.
    if (window.feedbackFirebase?.isEnabled?.()) {
        return new FirestoreFeedbackStore();
    }
    return new LocalFeedbackStore();
}

// 전역 노출 (다른 shared 모듈과 동일 컨벤션)
window.FeedbackStore = FeedbackStore;
window.LocalFeedbackStore = LocalFeedbackStore;
window.FirestoreFeedbackStore = FirestoreFeedbackStore;
window.createFeedbackStore = createFeedbackStore;
window.FEEDBACK_TYPES = FEEDBACK_TYPES;
window.FEEDBACK_STATUS = FEEDBACK_STATUS;
