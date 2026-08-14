// 게시판 공지를 앱 시작 시 팝업으로 알림 (SLS-1-219)
//
// SLS-1-218의 수정사항 팝업은 릴리스 노트가 출처라 **배포해야 내용이 바뀐다.**
// 이 모듈은 Firestore의 feedbackNotices를 읽어 배포 없이 공지를 낼 수 있게 한다.
// 공지 작성은 관리자 페이지(src/feedback-admin/)에서 하고, 보안 규칙이 쓰기를
// 관리자로 제한한다(firestore.rules의 isAdmin()).
//
// ⚠️ Electron 전용이다. 게시판 Firebase 설정(feedback-auth.json)은 forge.config.js의
//    extraResource로 설치본에만 동봉되고 IPC로 읽힌다(feedback-firebase.js:42).
//    웹에서는 조용히 아무것도 하지 않는다 — 그래서 이 팝업은 SLS-1-218을 대체하지 않고
//    보완한다(그쪽은 웹에서도 동작하고 네트워크가 필요 없다).
//
// ⚠️ 앱 시작 경로다. 모든 실패는 콘솔 로그만 남기고 넘어간다.
//    공지 때문에 앱이 안 켜지거나 느려지면 본말이 전도된다.

// 본 공지 기록은 src/shared/notice-seen.js에 모았다 (SLS-1-243) — 문의게시판도
// 같은 기록을 읽고 쓴다. 여기서 따로 구현하면 두 화면이 어긋난다.
const seenStore = () => window.noticeSeen;

const FETCH_LIMIT = 50;
const INIT_TIMEOUT_MS = 5000;

// 날짜 계산은 src/shared/notice-date.js에 모았다 — 관리자 목록(admin-script.js)이
// UTC로 계산해 로컬 기준인 이 팝업과 하루 어긋났다(코드리뷰 MAJOR). 같은 함수를 쓴다.
const todayStr = () => window.noticeTodayStr();

const readSeen = () => seenStore().readSeen();
const writeSeen = (ids, existingIds) => seenStore().writeSeen(ids, existingIds);

function pickNotices(all, seenIds, today) {
    const seen = new Set(seenIds);
    return (all || [])
        // 엄격 비교 — popup 필드가 없는 기존 공지는 제외된다.
        // 이미 발행된 공지가 갑자기 팝업으로 튀어나오면 안 된다.
        .filter((n) => n && n.popup === true)
        .filter((n) => !window.isNoticeExpired(n.until, today))
        .filter((n) => !seen.has(n.id));
}

/**
 * 익명 인증에 타임아웃을 씌운다.
 *
 * feedback-firebase.js의 navigator.onLine 체크는 완전 오프라인만 잡는다.
 * "인터넷은 되는데 구글 도메인만 조용히 버리는" 방화벽에서는 요청이 무기한 매달린다.
 * 앱 시작을 막지는 않지만(fire-and-forget) 매달린 요청을 남기지 않는다.
 */
function initWithTimeout(ms) {
    return Promise.race([
        window.feedbackFirebase.initialize(),
        new Promise((resolve) => setTimeout(() => resolve(false), ms)),
    ]);
}

/** 공지 블록을 그린다. body는 textContent — innerHTML 미사용 */
function renderBody(container, notices) {
    container.textContent = '';
    for (const n of notices) {
        const block = document.createElement('div');
        block.className = 'notice-entry';

        const head = document.createElement('div');
        head.className = 'notice-entry-head';
        const title = document.createElement('span');
        title.className = 'notice-title';
        title.textContent = n.title || '(제목 없음)';
        const date = document.createElement('span');
        date.className = 'notice-date';
        date.textContent = (n.createdAt || '').slice(0, 10);
        head.append(title, date);

        // ⚠️ white-space: pre-wrap CSS가 개행을 보존한다.
        //    관리자 입력은 textarea라 여러 줄을 전제하고, 기존 표시처 두 곳은 개행을
        //    <br>로 바꾼다(feedback-script.js:62, admin-script.js:144).
        //    여기서는 <br>를 주입하지 않고(textContent의 보안 특성 유지) CSS로 해결한다.
        const body = document.createElement('div');
        body.className = 'notice-popup-body';
        body.textContent = n.body || '';

        block.append(head, body);
        container.appendChild(block);
    }
}

async function run() {
    // 웹에서는 게시판 Firebase 설정이 없다 — 조용히 종료
    if (!window.electronAPI?.isElectron) return;
    if (!window.feedbackFirebase?.initialize || !window.createFeedbackStore) return;

    const ok = await initWithTimeout(INIT_TIMEOUT_MS);
    if (!ok) return;   // 설정 없음 / 인증 실패 / 타임아웃 — 모두 조용히

    const store = window.createFeedbackStore();
    if (typeof store?.listNotices !== 'function') return;

    const all = await store.listNotices({ limit: FETCH_LIMIT });
    const allIds = (all || []).map((n) => n.id);
    const seenIds = readSeen();
    const picked = pickNotices(all, seenIds, todayStr());

    if (picked.length === 0) {
        writeSeen(seenIds, allIds);   // 삭제된 공지 id 정리
        return;
    }

    const modal = document.getElementById('noticeModal');
    const body = document.getElementById('noticeBody');
    const okBtn = document.getElementById('noticeOk');
    if (!modal || !body || !okBtn) return;

    // SLS-1-218 팝업과 동시에 뜨면 같은 .sync-modal z-index를 공유해 겹쳐 깨진다.
    // 없을 수도 있다고 가정한다(로드 순서·초기화 실패) — 없으면 즉시 진행.
    await (window.whatsNewPopup?.whenClosed?.() ?? Promise.resolve());

    renderBody(body, picked);

    // ⚠️ 닫기 순서를 바꾸지 말 것 — 모달을 먼저 닫고 기록은 try/catch 안에서.
    //    반대면 용량 초과 시 예외가 닫기를 막아 모달이 안 닫히고, 기록도 안 됐으니
    //    새로고침해도 또 뜬다 → 앱을 못 쓴다 (SLS-1-198).
    const close = () => {
        modal.classList.remove('show');
        writeSeen([...seenIds, ...picked.map((n) => n.id)], allIds);
    };

    okBtn.addEventListener('click', close);
    modal.querySelector('.notice-close')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) close();
    });

    modal.classList.add('show');
}

// fire-and-forget — await하지 않는다. 오프라인에서 익명 인증이 지연돼도
// 다른 초기화(버전 표시·게시판 버튼 노출 등)를 막지 않는다.
void (async () => {
    try {
        await run();
    } catch (e) {
        (window.logger?.warn || console.warn)('[notice] 공지 팝업 실패:', e?.message || e);
    }
})();

// 테스트용 노출 (프로덕션 동작에는 쓰이지 않는다)
// ⚠️ SEEN_KEY는 공유 모듈을 거치지 않고 고정값으로 둔다. getter가 seenStore()를
//    타면 모듈이 없을 때(테스트 정리·로드 순서 변경) 접근만으로 예외가 난다.
window.__noticePopup = { pickNotices, readSeen, writeSeen, todayStr, initWithTimeout, run,
    SEEN_KEY: 'seenNoticeIds' };
