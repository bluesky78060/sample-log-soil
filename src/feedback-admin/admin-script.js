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

/**
 * 로그인 직후 불러오는 것들.
 *
 * 🚨 여기에 loadReleaseStats를 **넣지 않는다** (SLS-1-252).
 *    현황 탭을 처음 열 때만 부른다 — 안 보는 사람의 GitHub 한도(IP당 60회/시간)를
 *    쓰지 않기 위해서다. 함수로 뺀 이유는 E2E가 **이 경로를 실제로 실행해** 검증하기
 *    위해서다(로그인은 Firebase가 필요해 E2E로 못 탄다).
 */
async function loadAdminData() {
    await Promise.all([loadInquiries(), loadNotices()]);
}

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
    await loadAdminData();
}

/** 로그아웃 */
async function onLogout() {
    try {
        await window.feedbackFirebase.signOutAdmin();
    } finally {
        // 편집 중이던 상태가 남으면, 다시 로그인했을 때 남의 문서에 set 할 수 있다.
        // 로그아웃이 실패해도 상태는 비워야 한다 — 그래서 finally다.
        resetNoticeForm();
        // 통계 캐시도 비운다 (SLS-1-250 코드리뷰). 안 비우면 다시 로그인했을 때
        // 60초 캐시가 살아 있어 낡은 수치를 보여주고 새로 조회하지 않는다.
        clearReleaseStatsCache();
        _statsTabOpened = false;
        activateAdminTab('inquiry');   // 다음 로그인은 기본 탭에서 시작한다
    }
    showLogin();
    // 포커스가 숨겨진 관리자 영역에 남으면 키보드 사용자가 길을 잃는다 (코드리뷰 MINOR)
    $('adminEmail')?.focus();
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
        // 🚨 실패를 '0'으로 쓰지 않는다 (SLS-1-252 계획 리뷰).
        //    탭 뱃지로 옮기면서 '0'이 **"문의 없음"으로 읽힌다** — 답할 게 없다고 오해한다.
        //    카드 제목에 있을 때보다 위험해졌으므로 모름(—)으로 구분한다.
        $('inquiryCount').textContent = '—';
        $('inquiryCount').title = '문의를 불러오지 못했습니다';
        // title만으로는 스크린리더에 '—'의 뜻이 전달되지 않는다 (코드리뷰 MINOR)
        $('inquiryCount').setAttribute('aria-label', '문의 조회 실패');
        return;
    }
    docs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $('inquiryCount').textContent = String(docs.length);
    $('inquiryCount').title = '';
    $('inquiryCount').setAttribute('aria-label', `문의 ${docs.length}건`);
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

// ========================================
// 릴리스 배포 현황 (SLS-1-250)
// ========================================
//
// 🚨 이 카드에서 가장 중요한 산출물은 숫자가 아니라 **경고 상자**다.
//    과거에 setup.exe 다운로드 수를 "수동 설치"로 읽고 "자동 업데이트가 동작하지 않는다"고
//    잘못 결론 낸 적이 있다(CLAUDE.md에 정정 기록). 숫자만 크게 띄우면 또 그렇게 된다.
//    경고 상자는 접거나 숨기지 않는다.

const GH_OWNER = 'bluesky78060';
const GH_REPO = 'sample-log-soil';
const GH_PAGE_SIZE = 100;   // 미지정 시 기본 30이라 반드시 명시한다
const GH_MAX_PAGES = 5;     // 폭주 방지 상한 (500개)
const GH_TIMEOUT_MS = 10000;
const GH_CACHE_MS = 60000;  // 한도가 IP당 60회/시간 — 새로고침 연타를 막는다
const VERSION_BAR_LIMIT = 8;

/** 설치 파일 판별. 자산은 setup.exe · latest.yml · RELEASES · *.nupkg 넷뿐이다. */
const isSetupAsset = (name) => typeof name === 'string' && name.endsWith('setup.exe');

/**
 * GitHub 릴리스 배열 → 화면에 필요한 값만 계산하는 **순수 함수**.
 * 네트워크·DOM 비의존 (유닛 테스트 대상). 결함은 fetch가 아니라 여기 산다.
 *
 * ⚠️ prerelease는 총합·버전별·월별에는 **포함**하고 `latestTag`에서만 **제외**한다.
 *    업데이터가 allowPrerelease 기본 false라, 화면의 "현재 최신"은 사용자가 실제로
 *    받는 버전과 같아야 한다.
 *
 * @param {Array} releases
 * @returns {{totalSetup:number, latestTag:string, releaseCount:number,
 *            topVersion:string, byVersion:Array, byMonth:Array}}
 */
function computeReleaseStats(releases) {
    const list = Array.isArray(releases) ? releases : [];
    const byVersion = [];
    const monthMap = new Map();
    let totalSetup = 0;
    let latest = null;

    for (const r of list) {
        if (!r || typeof r !== 'object') continue;
        const tag = String(r.tag_name ?? '');
        const assets = Array.isArray(r.assets) ? r.assets : [];

        let count = 0;
        for (const a of assets) {
            if (!a || !isSetupAsset(a.name)) continue;
            const n = Number(a.download_count);
            // 문자열·누락·NaN이 하나만 섞여도 합계 전체가 NaN이 되어 화면이 물든다
            if (Number.isFinite(n) && n >= 0) count += n;
        }
        totalSetup += count;

        const pub = r.published_at ? new Date(r.published_at) : null;
        const at = pub && !Number.isNaN(pub.getTime()) ? pub.getTime() : 0;
        byVersion.push({ tag, count, at });

        if (at) {
            const key = `${pub.getFullYear()}-${String(pub.getMonth() + 1).padStart(2, '0')}`;
            monthMap.set(key, (monthMap.get(key) || 0) + count);
            // "현재 최신"은 정식 릴리스 중 가장 최근
            if (!r.prerelease && (!latest || at > latest.at)) latest = { tag, at };
        }
    }

    // ⚠️ 동률은 **published_at으로** 가른다 (SLS-1-250 코드리뷰).
    //    처음엔 배열 순서(GitHub이 최신순으로 준다는 가정)를 썼는데, 그건 문서화된 보장이
    //    아니다. 순서가 뒤집히면 동률에서 옛 버전을 최다로 표시한다 — 실측으로 확인했다.
    byVersion.sort((a, b) => b.count - a.count || b.at - a.at);

    return {
        totalSetup,
        latestTag: latest ? latest.tag : '',
        releaseCount: list.length,
        topVersion: byVersion.length && byVersion[0].count > 0 ? byVersion[0].tag : '',
        byVersion: byVersion.map(({ tag, count }) => ({ tag, count })),
        byMonth: [...monthMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, count]) => ({ month, count }))
    };
}

/**
 * `Link` 헤더의 rel="next" 추출. 100개를 넘어도 누락되지 않게 한다
 * (지금 52개, 주 1회씩 늘면 1년 내 100 돌파).
 */
function parseNextLink(linkHeader) {
    if (!linkHeader) return '';
    const m = String(linkHeader).match(/<([^>]+)>\s*;\s*rel="next"/);
    return m ? m[1] : '';
}

/**
 * 실패 사유 판정.
 * ⚠️ 403만 보고 "한도 초과"라 하면 오진한다 — 403은 다른 사유로도 온다.
 *    한도는 403 **또는** 429이면서 x-ratelimit-remaining이 0일 때다.
 *    네트워크/CORS 실패는 응답 객체 자체가 없으므로 한도가 아니다.
 */
function describeGhFailure(res) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    if ((res.status === 403 || res.status === 429) && remaining === '0') {
        const reset = Number(res.headers.get('x-ratelimit-reset'));
        const when = Number.isFinite(reset) && reset > 0
            ? new Date(reset * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : '';
        return `GitHub 조회 한도를 다 썼습니다${when ? ` — ${when} 이후 다시 시도하세요` : ''}.`;
    }
    if (res.status === 404) return '저장소를 찾을 수 없습니다.';
    return `조회 실패 (HTTP ${res.status})`;
}

let _statsInFlight = null;
let _statsCache = null;   // { at:number, stats:object }

let _statsGen = 0;        // 세대 토큰 — 뒤늦게 도착한 이전 요청의 결과를 버린다

/** 로그아웃 시 호출 — 재로그인에서 낡은 수치가 재사용되지 않게 한다 */
function clearReleaseStatsCache() {
    _statsCache = null;
    _statsGen += 1;
    // 🚨 진행 중 요청 슬롯도 비운다 (SLS-1-252 코드리뷰 MAJOR).
    //    안 비우면 로그아웃 → 곧바로 재로그인 → 현황 탭에서, 폐기된 옛 요청의 약속을
    //    그대로 돌려받는다. 그 결과는 세대 검사로 버려지므로 화면이 '불러오는 중…'에
    //    멈춘 채 재시도도 하지 않는다.
    _statsInFlight = null;
}

/**
 * 릴리스 전체를 페이지네이션으로 받아온다.
 * @returns {Promise<{releases:Array, truncated:boolean}>}
 *   truncated: 상한(5페이지)에 걸렸는데 뒤에 더 있다 — **조용히 자르지 않고 화면에 알린다**
 */
async function fetchAllReleases() {
    let url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/releases?per_page=${GH_PAGE_SIZE}`;
    const all = [];
    for (let page = 0; page < GH_MAX_PAGES && url; page++) {
        const ctrl = new AbortController();
        // ⚠️ 타임아웃은 **본문을 다 읽을 때까지** 살려둔다 (SLS-1-250 코드리뷰).
        //    fetch가 풀리는 시점은 헤더 수신이라, 여기서 타이머를 끄면 res.json()이
        //    멈췄을 때 영원히 기다린다. 그러면 _statsInFlight가 남아 이후 새로고침까지 막힌다.
        const timer = setTimeout(() => ctrl.abort(), GH_TIMEOUT_MS);
        let body, link;
        try {
            const res = await fetch(url, {
                headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal
            });
            if (!res.ok) throw new Error(describeGhFailure(res));
            body = await res.json();
            link = res.headers.get('link');
        } finally {
            clearTimeout(timer);
        }
        if (!Array.isArray(body)) throw new Error('응답 형식이 예상과 다릅니다.');
        all.push(...body);
        url = parseNextLink(link);
    }
    // 상한에 걸렸는데 다음 페이지가 남아 있으면 숫자가 잘린 것이다 (적대적 검증 지적).
    return { releases: all, truncated: Boolean(url) };
}

/**
 * 릴리스 통계 로드 + 렌더
 * @param {{force?: boolean}} [opts] force=true면 캐시를 건너뛴다 (새로고침 버튼)
 *
 * ⚠️ 세대(_statsGen) 토큰을 쓴다 (적대적 검증 지적). 로그아웃/재로그인 사이에
 *    이전 요청이 뒤늦게 성공하면, 그 결과가 지금 화면에 그려져 어느 시점 값인지
 *    알 수 없게 된다. 세대가 바뀌었으면 결과를 버린다.
 */
async function loadReleaseStats(opts) {
    const box = $('releaseStats');
    if (!box) return;
    const force = opts?.force === true;
    // 진행 중이면 그 약속을 함께 기다린다 (중복 요청 방지)
    if (_statsInFlight) return _statsInFlight;
    // 로그인 시 자동 조회는 60초 캐시를 쓰지만, **사용자가 새로고침을 누르면 반드시 새로 받는다.**
    // 안 그러면 "새로고침했는데 안 바뀐다"가 된다.
    if (!force && _statsCache && Date.now() - _statsCache.at < GH_CACHE_MS) {
        renderReleaseStats(_statsCache.stats);
        return;
    }
    const gen = ++_statsGen;
    window.setInnerHTML(box, '<div class="hint">불러오는 중…</div>');
    _statsInFlight = (async () => {
        try {
            const { releases, truncated } = await fetchAllReleases();
            const stats = { ...computeReleaseStats(releases), truncated };
            if (gen !== _statsGen) return;          // 그 사이 로그아웃/재요청 — 버린다
            _statsCache = { at: Date.now(), stats };
            renderReleaseStats(stats);
        } catch (e) {
            if (gen !== _statsGen) return;
            // 🚨 실패를 0으로 렌더하지 않는다. "0회"로 보이면 배포가 안 나간 것으로 오해한다.
            const msg = e?.name === 'AbortError' ? '조회 시간이 초과됐습니다.'
                : (e?.message || '조회 실패 — 네트워크를 확인하세요.');
            window.setInnerHTML(box, `<div class="stats-fail">⚠️ ${window.escapeHTML(msg)}</div>`);
        } finally {
            // ⚠️ 내 세대일 때만 슬롯을 비운다. 그냥 null로 두면 로그아웃 뒤 시작된
            //    **새 요청의 슬롯**을 옛 요청이 지워, 그 다음 호출이 중복 요청을 낸다.
            if (gen === _statsGen) _statsInFlight = null;
        }
    })();
    return _statsInFlight;
}

/** 막대 목록 마크업 */
function statBars(rows, labelKey) {
    const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
    const esc = window.escapeHTML;
    return rows.map((r) => {
        // max가 0이면 0으로 나누게 된다 — 다운로드가 하나도 없을 때 실제로 발생한다
        const pct = max > 0 ? Math.round((r.count / max) * 100) : 0;
        return `<div class="stat-bar">
            <span class="lab">${esc(r[labelKey])}</span>
            <span class="track"><span class="fill" style="width:${pct}%"></span></span>
            <span class="num">${esc(String(r.count))}</span>
        </div>`;
    }).join('');
}

function renderReleaseStats(s) {
    const box = $('releaseStats');
    if (!box) return;
    if (!s.releaseCount) {
        window.setInnerHTML(box, '<div class="hint">공개된 릴리스가 없습니다.</div>');
        return;
    }
    const esc = window.escapeHTML;
    const dash = (v) => (v ? esc(v) : '—');
    const versions = s.byVersion.filter((v) => v.count > 0).slice(0, VERSION_BAR_LIMIT);

    window.setInnerHTML(box, `
        <div class="stat-figures">
            <div class="fig"><div class="k">설치 파일 내려간 횟수</div><div class="v">${esc(String(s.totalSetup))}<small>회</small></div></div>
            <div class="fig"><div class="k">현재 최신</div><div class="v">${dash(s.latestTag)}</div></div>
            <div class="fig"><div class="k">누적 릴리스</div><div class="v">${esc(String(s.releaseCount))}<small>개</small></div></div>
            <div class="fig"><div class="k">최다 배포 버전</div><div class="v">${dash(s.topVersion)}</div></div>
        </div>
        ${s.truncated ? `<div class="stats-partial">⚠️ 릴리스가 많아 최근 ${GH_PAGE_SIZE * GH_MAX_PAGES}개까지만 집계했습니다 — 실제 합계는 이보다 큽니다.</div>` : ''}
        ${versions.length ? `<div class="stat-label">버전별 (상위 ${versions.length}개)</div>${statBars(versions, 'tag')}` : ''}
        ${s.byMonth.length ? `<div class="stat-label">릴리스 공개 월 기준</div>${statBars(s.byMonth, 'month')}` : ''}
        <div class="stat-note" id="releaseStatsNote">
            <strong>⚠️ 이 숫자로 알 수 없는 것</strong>
            <ul>
                <li><b>자동 업데이트인지 직접 내려받은 건지 구분되지 않습니다.</b> 업데이터도 같은 setup.exe를 받아가고, GitHub은 누가 받았는지 알려주지 않습니다.</li>
                <li><b>사용 기관 수가 아닙니다.</b> 한 곳이 열두 버전을 거치면 12회로 잡힙니다.</li>
                <li>월별은 <b>다운로드 시점이 아니라 릴리스가 공개된 달</b> 기준입니다. GitHub이 다운로드 시각을 주지 않습니다.</li>
                <li><b>누가 안 받았는지는 나오지 않습니다.</b></li>
            </ul>
        </div>`);
}

// ========================================
// 탭 전환 (SLS-1-252)
// ========================================

/** 현황 탭을 한 번이라도 열었나 — 첫 열람에만 조회한다 */
let _statsTabOpened = false;

/**
 * 탭 전환.
 *
 * ⚠️ 통계는 **현황 탭을 처음 열 때만** 부른다.
 *    로그인마다 부르면 안 보는 사람도 GitHub API를 쓴다 — 한도가 **IP당 60회/시간**이다.
 *
 * @param {'notice'|'inquiry'|'stats'} name
 */
function activateAdminTab(name) {
    document.querySelectorAll('.board-tab').forEach((btn) => {
        btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
    });
    const panels = {
        notice: $('panelNoticeAdmin'),
        inquiry: $('panelInquiryAdmin'),
        stats: $('panelStatsAdmin'),
    };
    for (const [key, el] of Object.entries(panels)) {
        if (el) el.hidden = key !== name;
    }
    if (name === 'stats' && !_statsTabOpened) {
        _statsTabOpened = true;
        loadReleaseStats();
    }
}

function init() {
    $('loginForm')?.addEventListener('submit', onLogin);
    document.querySelectorAll('.board-tab').forEach((btn) => {
        btn.addEventListener('click', () => activateAdminTab(btn.dataset.tab));
    });
    $('noticeForm')?.addEventListener('submit', addNotice);
    $('noticeCancelBtn')?.addEventListener('click', resetNoticeForm);
    $('logoutBtn')?.addEventListener('click', onLogout);
    // 새로고침은 캐시를 건너뛴다 — 눌렀는데 안 바뀌면 고장으로 보인다
    // 새로고침은 캐시를 건너뛴다 — 눌렀는데 안 바뀌면 고장으로 보인다.
    // 단, 현황 탭을 연 적이 없으면 통계는 건드리지 않는다 (안 보는 화면을 새로 받을 이유가 없다).
    $('refreshBtn')?.addEventListener('click', () => Promise.all([
        loadInquiries(),
        loadNotices(),
        _statsTabOpened ? loadReleaseStats({ force: true }) : Promise.resolve(),
    ]));
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
window.__adminTabs = { activateAdminTab, loadAdminData };
window.__adminStats = {
    computeReleaseStats, parseNextLink, describeGhFailure, loadReleaseStats, clearReleaseStatsCache
};
