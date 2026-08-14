// ========================================
// 문의/건의 게시판 UI 로직 (SLS-1-148)
// 공지(읽기 전용) + 1:1 문의(작성/목록/철회)
// 저장소는 feedback-store.js의 어댑터를 통해 접근하므로
// 추후 Firestore 연결 시 이 파일은 수정 불필요.
// ========================================

// 저장소는 init()에서 Firebase 초기화 이후 생성한다 (연결 시 Firestore, 아니면 로컬).
let store = null;

// 입력 길이 한도 (HTML maxlength와 단일 출처로 일치시킴)
const MAX_TITLE_LEN = 200;
const MAX_BODY_LEN = 2000;

// DOM 헬퍼
const $ = (id) => document.getElementById(id);

// 상태 배지 색상 클래스 매핑
const STATUS_CLASS = {
    [window.FEEDBACK_STATUS.RECEIVED]: 'status-received',
    [window.FEEDBACK_STATUS.IN_PROGRESS]: 'status-progress',
    [window.FEEDBACK_STATUS.DONE]: 'status-done'
};

/** ISO 문자열을 'YYYY-MM-DD HH:mm' 형태로 표시 */
function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 문의 유형 <select> 옵션 채우기 */
function populateTypeOptions() {
    const sel = $('inquiryType');
    if (!sel) return;
    sel.innerHTML = '';
    window.FEEDBACK_TYPES.forEach((t) => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        sel.appendChild(opt);
    });
}

/**
 * 탭 전환 (SLS-1-243)
 * @param {'notice'|'inquiry'} name
 */
function activateTab(name) {
    document.querySelectorAll('.board-tab').forEach((btn) => {
        btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
    });
    const panelNotice = $('panelNotice');
    const panelInquiry = $('panelInquiry');
    if (panelNotice) panelNotice.hidden = name !== 'notice';
    if (panelInquiry) panelInquiry.hidden = name !== 'inquiry';
}

/** 안 본 공지 건수를 탭 배지에 반영 (0이면 감춘다) */
function updateNoticeBadge(count) {
    const badge = $('noticeBadge');
    if (!badge) return;
    badge.textContent = String(count);
    badge.hidden = count <= 0;
}

/**
 * 공지 목록 렌더링 — 제목만 보이고 누르면 펼친다.
 *
 * ⚠️ 접기는 CSS 클래스(.open)로 한다. hidden 속성은 setInnerHTML의 새니타이저가
 *    지우므로(sanitize.js의 ALLOWED_ATTR에 없다) 본문이 그대로 펼쳐진다.
 *
 * @returns {Promise<number>} 아직 안 본 공지 건수
 */
async function renderNotices() {
    const wrap = $('noticeList');
    if (!wrap) return 0;
    const notices = await store.listNotices();
    if (notices.length === 0) {
        window.setInnerHTML(wrap, '<div class="empty-hint">등록된 공지가 없습니다.</div>');
        updateNoticeBadge(0);
        return 0;
    }

    // 본 공지 기록은 팝업(notice-popup.js)과 공유한다 — src/shared/notice-seen.js.
    // 모듈이 없어도 게시판은 동작해야 하므로 전부 안 본 것으로 취급한다.
    const seenApi = window.noticeSeen;
    const seen = new Set(seenApi?.readSeen?.() || []);

    const html = notices.map((n, i) => {
        const isNew = !seen.has(n.id);
        // 본문 id는 인덱스로 만든다 — 공지 id를 그대로 쓰면 따옴표·공백이 든 값에서
        // 선택자가 깨진다(이스케이프해도 CSS 식별자로는 부적합).
        const bodyId = `noticeBody-${i}`;
        return `
        <div class="notice-item${isNew ? ' unread' : ''}" data-id="${window.escapeHTML(n.id)}">
            <button type="button" class="notice-head" aria-expanded="false" aria-controls="${bodyId}">
                <span class="notice-chev" aria-hidden="true">▶</span>
                <span class="notice-title">${window.escapeHTML(n.title)}${isNew ? '<span class="notice-new" title="아직 읽지 않은 공지">N</span>' : ''}</span>
                <span class="notice-date">${window.escapeHTML(formatDate(n.createdAt))}</span>
            </button>
            <div class="notice-body" id="${bodyId}">${window.escapeHTML(n.body).replace(/\n/g, '<br>')}</div>
        </div>`;
    }).join('');
    window.setInnerHTML(wrap, html);

    const unread = notices.filter((n) => !seen.has(n.id)).length;
    updateNoticeBadge(unread);

    wrap.querySelectorAll('.notice-item').forEach((item) => {
        const head = item.querySelector('.notice-head');
        head?.addEventListener('click', () => onToggleNotice(item, head));
    });
    return unread;
}

/** 공지 펼치기/접기 — 처음 펼칠 때 '봤다'고 기록한다 */
function onToggleNotice(item, head) {
    const open = item.classList.toggle('open');
    head.setAttribute('aria-expanded', String(open));
    if (!open || !item.classList.contains('unread')) return;

    // 🚨 markSeen은 **추가만** 한다. writeSeen을 쓰면 팝업의 50건 조회 상한에 걸려
    //    그 밖의 공지 기록이 잘려 나간다 (notice-seen.js 주석 참조).
    //
    // ⚠️ 저장에 실패하면 화면도 그대로 둔다. 여기서 N을 떼면 새로고침 때 다시
    //    안 읽음이 되어 "읽었다고 표시됐는데 또 안 읽음"이 된다.
    if (!window.noticeSeen?.markSeen?.(item.dataset.id)) return;
    item.classList.remove('unread');
    item.querySelector('.notice-new')?.remove();

    const badge = $('noticeBadge');
    if (badge && !badge.hidden) {
        updateNoticeBadge(Math.max(0, parseInt(badge.textContent, 10) - 1));
    }
}

/** 문의 목록 렌더링 */
async function renderInquiries() {
    const wrap = $('inquiryList');
    if (!wrap) return;
    const inquiries = await store.listInquiries();
    if (inquiries.length === 0) {
        window.setInnerHTML(wrap, '<div class="empty-hint">아직 등록된 문의가 없습니다. 위 양식으로 문의를 남겨주세요.</div>');
        return;
    }
    const html = inquiries.map((q) => {
        const statusClass = STATUS_CLASS[q.status] || 'status-received';
        const replyBlock = q.reply
            ? `<div class="inquiry-reply"><strong>답변</strong><br>${window.escapeHTML(q.reply).replace(/\n/g, '<br>')}</div>`
            : '';
        const orgLine = q.org ? ` · ${window.escapeHTML(q.org)}` : '';
        return `
            <div class="inquiry-item">
                <div class="inquiry-head">
                    <span class="inquiry-type">${window.escapeHTML(q.type)}</span>
                    <span class="status-badge ${statusClass}">${window.escapeHTML(q.status)}</span>
                    <span class="inquiry-meta">${window.escapeHTML(formatDate(q.createdAt))}${orgLine}</span>
                    <button type="button" class="inquiry-del" data-id="${window.escapeHTML(q.id)}" title="이 문의 철회">삭제</button>
                </div>
                <div class="inquiry-title">${window.escapeHTML(q.title)}</div>
                <div class="inquiry-body">${window.escapeHTML(q.body).replace(/\n/g, '<br>')}</div>
                ${replyBlock}
            </div>
        `;
    }).join('');
    window.setInnerHTML(wrap, html);

    // 삭제 버튼 바인딩 (이벤트 위임 대신 개별 바인딩 — 단순 목록)
    wrap.querySelectorAll('.inquiry-del').forEach((btn) => {
        btn.addEventListener('click', () => onDeleteInquiry(btn.dataset.id));
    });
}

/** 문의 등록 처리 */
async function onSubmitInquiry(e) {
    e.preventDefault();
    const titleEl = $('inquiryTitle');
    const bodyEl = $('inquiryBody');
    if (!titleEl || !bodyEl) return; // 마크업 변경 등으로 필드 부재 시 방어

    const title = titleEl.value.trim();
    const body = bodyEl.value.trim();

    if (!title) {
        window.showToast?.('제목을 입력해주세요.', 'warning');
        titleEl.focus();
        return;
    }
    if (!body) {
        window.showToast?.('내용을 입력해주세요.', 'warning');
        bodyEl.focus();
        return;
    }
    if (title.length > MAX_TITLE_LEN) {
        window.showToast?.(`제목은 ${MAX_TITLE_LEN}자 이내로 입력해주세요.`, 'warning');
        return;
    }
    if (body.length > MAX_BODY_LEN) {
        window.showToast?.(`내용은 ${MAX_BODY_LEN}자 이내로 입력해주세요.`, 'warning');
        return;
    }

    try {
        await store.addInquiry({
            org: $('inquiryOrg')?.value || '',
            type: $('inquiryType')?.value || '',
            title,
            body,
            contact: $('inquiryContact')?.value || ''
        });
    } catch (err) {
        window.showToast?.(err?.message || '문의 등록에 실패했습니다.', 'error');
        return;
    }

    // 폼 초기화 (유형은 유지)
    titleEl.value = '';
    bodyEl.value = '';
    const contactEl = $('inquiryContact');
    if (contactEl) contactEl.value = '';

    window.showToast?.('문의가 등록되었습니다.', 'success');
    await renderInquiries();
}

/** 문의 철회 처리 */
async function onDeleteInquiry(id) {
    if (!id) return;
    if (!window.confirm('이 문의를 삭제하시겠습니까?')) return;
    try {
        await store.deleteInquiry(id);
    } catch (err) {
        window.showToast?.(err?.message || '삭제에 실패했습니다.', 'error');
        return;
    }
    window.showToast?.('문의가 삭제되었습니다.', 'success');
    await renderInquiries();
}

/** 저장 방식 안내 배너 (로컬 저장이면 안내 노출) */
function renderStorageHint() {
    const hint = $('storageHint');
    if (!hint) return;
    if (!store.isShared) {
        hint.style.display = 'block';
    } else {
        hint.style.display = 'none';
    }
}

/** 초기화 */
async function init() {
    populateTypeOptions();

    const form = $('inquiryForm');
    if (form) form.addEventListener('submit', onSubmitInquiry);

    // 게시판 전용 Firebase 초기화 (시료 데이터용 firebaseConfig와 독립).
    // 미설정/오프라인/실패면 false → 로컬 폴백. 익명 인증까지 끝나야 isEnabled()가
    // true가 되므로 반드시 await.
    try {
        await window.feedbackFirebase?.initialize?.();
    } catch (e) {
        (window.logger?.warn || console.warn)('[feedback] 게시판 Firebase 초기화 실패, 로컬 모드로 진행:', e);
    }

    store = window.createFeedbackStore();
    renderStorageHint();

    document.querySelectorAll('.board-tab').forEach((btn) => {
        btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });

    // 🚨 초기 탭은 공지를 그린 **뒤에** 정한다 — 그래야 안 본 건수를 안다.
    //    평소엔 문의 탭(이 화면에 오는 주된 이유)이지만, 알릴 것이 있으면 공지가 먼저다.
    const unread = await renderNotices();
    activateTab(unread > 0 ? 'notice' : 'inquiry');

    await renderInquiries();
}

document.addEventListener('DOMContentLoaded', init);
