// ========================================
// 관리자 페이지 로직 (SLS-1-154)
// 이메일/비밀번호 로그인 → 전체 문의 답변/상태 + 공지 관리.
// 보안 규칙(firestore.rules)의 isAdmin(ADMIN_UID)으로 권한이 강제된다.
// ========================================

const $ = (id) => document.getElementById(id);
const INQUIRY_COL = 'feedbackInquiries';
const NOTICE_COL = 'feedbackNotices';
const STATUSES = ['접수', '처리중', '완료'];

function db() { return window.feedbackFirebase?.getDb?.(); }

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function showAdmin() { $('loginSection').style.display = 'none'; $('adminSection').style.display = 'block'; }
function showLogin() { $('adminSection').style.display = 'none'; $('loginSection').style.display = 'block'; }

/** 로그인 */
async function onLogin(e) {
    e.preventDefault();
    const email = $('adminEmail').value.trim();
    const pw = $('adminPassword').value;
    if (!email || !pw) { window.showToast?.('이메일과 비밀번호를 입력하세요.', 'warning'); return; }
    const btn = $('loginBtn');
    btn.disabled = true;
    const r = await window.feedbackFirebase.signInAdmin(email, pw);
    btn.disabled = false;
    if (!r.ok) { window.showToast?.(r.error || '로그인에 실패했습니다.', 'error'); return; }
    $('adminPassword').value = '';
    showAdmin();
    window.showToast?.('로그인되었습니다.', 'success');
    await Promise.all([loadInquiries(), loadNotices()]);
}

/** 로그아웃 */
async function onLogout() {
    try {
        await window.feedbackFirebase.signOutAdmin();
    } finally {
        // 편집 중이던 상태가 남으면, 다시 로그인했을 때 남의 문서에 set 할 수 있다.
        // 로그아웃이 실패해도 상태는 비워야 한다 — 그래서 finally다.
        resetNoticeForm();
    }
    showLogin();
    window.showToast?.('로그아웃되었습니다.', 'success');
}

/** 전체 문의 조회 + 답변 UI 렌더 */
async function loadInquiries() {
    const wrap = $('inquiryList');
    wrap.innerHTML = '<div class="hint">불러오는 중...</div>';
    const docs = [];
    try {
        const snap = await db().collection(INQUIRY_COL).get();
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    } catch (e) {
        (window.logger?.error || console.error)('[admin] 문의 조회 실패:', e);
        window.setInnerHTML(wrap, '<div class="hint">조회 실패 — 보안 규칙의 ADMIN_UID가 이 계정 UID로 설정됐는지 확인하세요.</div>');
        $('inquiryCount').textContent = '0';
        return;
    }
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('inquiryCount').textContent = String(docs.length);
    if (!docs.length) { window.setInnerHTML(wrap, '<div class="hint">등록된 문의가 없습니다.</div>'); return; }

    const esc = window.escapeHTML;
    wrap.innerHTML = '';
    docs.forEach((q) => {
        const card = document.createElement('div');
        card.className = 'item';
        const meta = [fmtDate(q.createdAt), q.org, q.contact].filter(Boolean).map(esc).join(' · ');
        card.innerHTML = window.sanitizeHTML(`
            <div class="item-head">
                <span class="type">${esc(q.type)}</span>
                <span class="meta">${meta}</span>
            </div>
            <div class="title">${esc(q.title)}</div>
            <div class="body">${esc(q.body).replace(/\n/g, '<br>')}</div>
        `);

        // 답변/상태 입력 (이벤트 보존을 위해 DOM으로 생성)
        const area = document.createElement('div');
        area.className = 'reply-area';
        const sel = document.createElement('select');
        STATUSES.forEach((s) => {
            const o = document.createElement('option');
            o.value = s; o.textContent = s;
            if (s === q.status) o.selected = true;
            sel.appendChild(o);
        });
        const ta = document.createElement('textarea');
        ta.placeholder = '답변을 입력하세요';
        ta.value = q.reply || '';
        const btn = document.createElement('button');
        btn.className = 'btn-primary';
        btn.textContent = '답변 저장';
        btn.addEventListener('click', () => saveReply(q.id, ta.value, sel.value, btn));
        area.appendChild(sel);
        area.appendChild(ta);
        area.appendChild(btn);
        card.appendChild(area);
        wrap.appendChild(card);
    });
}

/** 답변/상태 저장 */
async function saveReply(id, reply, status, btn) {
    btn.disabled = true;
    try {
        await db().collection(INQUIRY_COL).doc(id).update({ reply: (reply || '').trim(), status });
        window.showToast?.('답변이 저장되었습니다.', 'success');
    } catch (e) {
        (window.logger?.error || console.error)('[admin] 답변 저장 실패:', e);
        window.showToast?.('저장 실패 — 관리자 권한을 확인하세요.', 'error');
    }
    btn.disabled = false;
}

/** 공지 조회 */
async function loadNotices() {
    const wrap = $('noticeList');
    wrap.innerHTML = '<div class="hint">불러오는 중...</div>';
    const docs = [];
    try {
        const snap = await db().collection(NOTICE_COL).get();
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
    } catch (e) {
        window.setInnerHTML(wrap, '<div class="hint">조회 실패</div>');
        return;
    }
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (!docs.length) { window.setInnerHTML(wrap, '<div class="hint">등록된 공지가 없습니다.</div>'); return; }
    const esc = window.escapeHTML;
    wrap.innerHTML = '';
    docs.forEach((n) => {
        const card = document.createElement('div');
        card.className = 'item';
        // 팝업 여부·만료 상태 표시 (SLS-1-219) — 관리자가 목록에서 바로 알 수 있게
        // ⚠️ 여기서 직접 날짜를 만들지 말 것. UTC(toISOString)로 계산하면 KST에서
        //    매일 00:00~08:59에 팝업(로컬 기준)과 하루 어긋난다 — 코드리뷰 MAJOR.
        const expired = window.isNoticeExpired(n.until);
        const badges = [];
        if (n.popup === true) {
            badges.push(expired
                ? '<span class="meta">📢 팝업(종료됨)</span>'
                : '<span class="meta">📢 팝업</span>');
        }
        if (n.until) badges.push(`<span class="meta">~${esc(n.until)}</span>`);

        card.innerHTML = window.sanitizeHTML(`
            <div class="item-head">
                <span class="title">${esc(n.title)}</span>
                <span class="meta">${esc(fmtDate(n.createdAt))}</span>
            </div>
            ${badges.length ? `<div>${badges.join(' ')}</div>` : ''}
            <div class="body">${esc(n.body).replace(/\n/g, '<br>')}</div>
        `);
        // ⚠️ 버튼은 createElement로 만든다 — innerHTML에 넣으면 새니타이저를 거치며
        //    이벤트를 다시 붙여야 한다. 기존 삭제 버튼이 이미 이 방식이다.
        const edit = document.createElement('button');
        edit.className = 'btn-secondary';
        edit.textContent = '수정';
        edit.style.marginTop = '0.6rem';
        edit.style.marginRight = '0.4rem';
        edit.addEventListener('click', () => startEditNotice(n));
        card.appendChild(edit);

        const del = document.createElement('button');
        del.className = 'btn-danger';
        del.textContent = '삭제';
        del.addEventListener('click', () => deleteNotice(n.id));
        card.appendChild(del);
        wrap.appendChild(card);
    });
}

// ── 공지 편집 (SLS-1-245) ─────────────────────────────────────────────
// 지금까지는 등록·삭제만 있어, 오타 하나를 고치려면 지우고 다시 써야 했다.
// 그러면 createdAt이 새로 찍혀 목록 맨 위로 올라가 사용자에게 새 공지처럼 보인다.
// ⚠️ 원본 문서를 여기 들고 있지 않는다. 저장 직전에 **다시 읽어** 쓴다 —
//    편집하는 동안 삭제되거나 다른 관리자가 고쳤을 수 있기 때문이다(addNotice 참조).
let editingId = null;      // null이면 등록 모드

/**
 * 저장할 공지 문서를 만든다. (순수 함수 — 테스트 대상)
 *
 * 🚨 수정은 `update()`가 아니라 **`set()`으로 문서를 교체**한다.
 *    `until`을 지우려면 `FieldValue.delete()` sentinel이 필요한데,
 *    `firebase` 전역이 없다(window.feedbackFirebase는 getDb 등만 노출).
 *    set이면 그 키를 안 넣는 것만으로 삭제가 된다.
 *
 * 🚨 그래서 **원본 필드를 함께 넘겨야 한다**(original 스프레드).
 *    빠뜨리면 조용히 사라진다 — 지금은 createdAt이 그 대상이고,
 *    나중에 필드가 늘어도 이 구조면 살아남는다.
 *
 * @param {{title:string, body:string, popup:boolean, until:string}} form
 * @param {object|null} original 수정 시 원본 문서(id 포함), 등록이면 null
 */
function buildNoticePayload(form, original) {
    const title = String(form.title ?? '').trim();
    const body = String(form.body ?? '').trim();
    // popup은 항상 boolean — notice-popup.js가 `=== true`로 엄격 비교한다
    const popup = form.popup === true;
    const until = String(form.until ?? '').trim();

    if (!original) {
        return { title, body, createdAt: new Date().toISOString(), popup, ...(until ? { until } : {}) };
    }
    // id는 문서 필드가 아니고, until은 아래에서 조건부로 다시 넣는다
    const { id: _id, until: _until, ...rest } = original;
    return { ...rest, title, body, popup, ...(until ? { until } : {}) };
}

/** 폼을 등록 모드로 되돌린다 */
function resetNoticeForm() {
    editingId = null;
    $('noticeTitle').value = '';
    $('noticeBody').value = '';
    if ($('noticePopup')) $('noticePopup').checked = false;
    if ($('noticeUntil')) $('noticeUntil').value = '';
    if ($('noticeFormTitle')) $('noticeFormTitle').textContent = '공지 작성';
    if ($('noticeSubmitBtn')) $('noticeSubmitBtn').textContent = '공지 등록';
    if ($('noticeCancelBtn')) $('noticeCancelBtn').hidden = true;
    if ($('noticeEditHint')) $('noticeEditHint').hidden = true;
}

/** 공지를 폼에 불러와 편집 모드로 (SLS-1-245) */
function startEditNotice(n) {
    editingId = n.id;
    $('noticeTitle').value = n.title || '';
    $('noticeBody').value = n.body || '';
    if ($('noticePopup')) $('noticePopup').checked = n.popup === true;
    if ($('noticeUntil')) $('noticeUntil').value = n.until || '';
    if ($('noticeFormTitle')) $('noticeFormTitle').textContent = '공지 수정';
    if ($('noticeSubmitBtn')) $('noticeSubmitBtn').textContent = '수정 저장';
    if ($('noticeCancelBtn')) $('noticeCancelBtn').hidden = false;
    if ($('noticeEditHint')) $('noticeEditHint').hidden = false;
    // 목록이 길면 폼이 화면 밖이다
    $('noticeForm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('noticeTitle')?.focus();
}

/** 공지 등록 / 수정 */
async function addNotice(e) {
    e.preventDefault();
    const title = $('noticeTitle').value.trim();
    const body = $('noticeBody').value.trim();
    if (!title || !body) { window.showToast?.('제목과 내용을 입력하세요.', 'warning'); return; }
    // 팝업 알림 / 표시 종료일 (SLS-1-219)
    const popup = $('noticePopup')?.checked === true;
    const until = ($('noticeUntil')?.value || '').trim();
    const editing = editingId;
    const form = { title, body, popup, until };
    try {
        if (editing) {
            // 🚨 저장 직전에 **다시 읽는다.** set()은 없는 문서를 새로 만들기 때문에,
            //    편집하는 동안 그 공지가 지워졌다면 그대로 **되살아난다.**
            //    (update()라면 실패하지만 sentinel을 못 써서 set을 쓴다 — 계획 리뷰 참조)
            //
            //    다시 읽은 값을 원본으로 삼으므로, 그 사이 다른 관리자가 고친 필드도
            //    편집 시작 시점의 낡은 값으로 덮이지 않는다.
            const ref = db().collection(NOTICE_COL).doc(editing);
            const snap = await ref.get();
            if (!snap.exists) {
                window.showToast?.('이미 삭제된 공지입니다.', 'warning');
                resetNoticeForm();
                await loadNotices();
                return;
            }
            await ref.set(buildNoticePayload(form, { id: snap.id, ...snap.data() }));
        } else {
            await db().collection(NOTICE_COL).add(buildNoticePayload(form, null));
        }
        resetNoticeForm();
        window.showToast?.(editing ? '공지가 수정되었습니다.' : '공지가 등록되었습니다.', 'success');
        await loadNotices();
    } catch (e2) {
        (window.logger?.error || console.error)('[admin] 공지 저장 실패:', e2);
        window.showToast?.(
            editing ? '수정 실패 — 관리자 권한을 확인하세요.' : '등록 실패 — 관리자 권한을 확인하세요.',
            'error');
    }
}

/** 공지 삭제 */
async function deleteNotice(id) {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;
    try {
        await db().collection(NOTICE_COL).doc(id).delete();
        // 편집 중이던 공지가 사라졌으면 폼도 등록 모드로 (안 그러면 없는 문서에 set 한다)
        if (editingId === id) resetNoticeForm();
        window.showToast?.('삭제되었습니다.', 'success');
        await loadNotices();
    } catch (e) {
        window.showToast?.('삭제 실패', 'error');
    }
}

function init() {
    $('loginForm')?.addEventListener('submit', onLogin);
    $('noticeForm')?.addEventListener('submit', addNotice);
    $('noticeCancelBtn')?.addEventListener('click', resetNoticeForm);
    $('logoutBtn')?.addEventListener('click', onLogout);
    $('refreshBtn')?.addEventListener('click', () => Promise.all([loadInquiries(), loadNotices()]));
    // 웹(데스크톱 아님)에서는 게시판 설정이 없어 로그인 불가 — 안내 노출
    if (!window.electronAPI?.isElectron) {
        const w = $('webWarn');
        if (w) w.style.display = 'block';
    }
}

document.addEventListener('DOMContentLoaded', init);

// 테스트용 노출 (프로덕션 동작에는 쓰이지 않는다) — window.__noticePopup과 같은 방식.
// admin-script.js에는 export가 없어 순수 함수를 이렇게 잡는다.
window.__adminNotice = { buildNoticePayload, addNotice, resetNoticeForm, startEditNotice };
