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

/** 공지 목록 렌더링 */
async function renderNotices() {
    const wrap = $('noticeList');
    if (!wrap) return;
    const notices = await store.listNotices();
    if (notices.length === 0) {
        window.setInnerHTML(wrap, '<div class="empty-hint">등록된 공지가 없습니다.</div>');
        return;
    }
    const html = notices.map((n) => `
        <div class="notice-item">
            <div class="notice-head">
                <span class="notice-title">${window.escapeHTML(n.title)}</span>
                <span class="notice-date">${window.escapeHTML(formatDate(n.createdAt))}</span>
            </div>
            <div class="notice-body">${window.escapeHTML(n.body).replace(/\n/g, '<br>')}</div>
        </div>
    `).join('');
    window.setInnerHTML(wrap, html);
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

    await renderNotices();
    await renderInquiries();
}

document.addEventListener('DOMContentLoaded', init);
