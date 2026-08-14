// 본 공지 기록 (SLS-1-243)
//
// ⚠️ 이 파일이 존재하는 이유: 공지를 "봤다"고 기록하는 곳이 **두 군데**가 됐다.
//      팝업   — 앱 시작 시 뜬 공지를 닫으면 기록 (notice-popup.js)
//      게시판 — 문의게시판에서 공지를 펼쳐 보면 기록 (feedback-script.js)
//    같은 기록을 봐야 한다. 안 그러면 팝업에서 이미 읽은 공지가 게시판에서
//    "안 읽음"으로 남고, 게시판에서 읽은 공지가 팝업으로 또 뜬다.
//
//    notice-popup.js가 노출하던 window.__noticePopup은 주석에 "테스트용"이라
//    적혀 있었고, 애초에 그 파일은 main-entry.js에서만 로드된다(게시판에는 없다).
//    notice-date.js가 같은 이유로 분리된 선례를 따른다.

const SEEN_KEY = 'seenNoticeIds';

function readSeen() {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];   // 손상된 값은 빈 목록으로 — 공지가 한 번 더 뜨는 정도의 열화
    }
}

function save(list) {
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        // 용량 초과 등. 공지가 다시 뜨는 것은 감수한다 (SLS-1-198 참조).
        (window.logger?.warn || console.warn)('[notice] 공지 기록 실패:', e?.message || e);
        return false;
    }
}

/**
 * 본 공지 id를 저장하면서 **없어진 공지를 정리**한다. (팝업 전용)
 *
 * ⚠️ FIFO로 N개만 남기지 않는다. until이 없는(무기한) 공지는 만료 필터에 걸리지 않으므로,
 *    캡에서 밀려나면 다시 "본 적 없음"이 되어 재출현한다.
 *    → 조회 결과에 **존재하는 id만** 남긴다. 삭제된 공지는 어차피 다시 뜰 수 없다.
 *
 * @param {string[]} ids         저장할 id 목록
 * @param {string[]} existingIds 지금 조회된 전체 공지 id (여기 없는 id는 버린다)
 */
function writeSeen(ids, existingIds) {
    const alive = new Set(existingIds);
    save([...new Set(ids)].filter((id) => alive.has(id)));
}

/**
 * 공지 하나를 "봤다"고 **추가만** 한다. (게시판 전용)
 *
 * 🚨 여기서 writeSeen을 쓰면 안 된다. 팝업은 **50건만** 조회하는데(FETCH_LIMIT),
 *    게시판은 전체를 보여준다. 게시판이 51번째 이후 공지를 읽고 writeSeen으로
 *    저장하면, 팝업이 다음에 저장할 때 그 id가 "존재하지 않는 공지"로 잘려
 *    **다시 안 본 것이 된다.**
 *
 *    그래서 게시판은 정리하지 않고 추가만 한다. 삭제된 공지 id가 남는 것은
 *    무해하다 — 그 공지는 다시 뜰 수 없고, 정리는 팝업이 계속 맡는다.
 *
 * @param {string} id
 * @returns {boolean} 새로 추가됐으면 true (이미 있었으면 false)
 */
function markSeen(id) {
    if (!id) return false;
    const list = readSeen();
    if (list.includes(id)) return false;
    // ⚠️ 저장 성공 여부를 그대로 돌려준다. 실패했는데 true를 주면 호출부가 화면에서
    //    'N'을 떼는데, 새로고침하면 다시 안 읽음이 되어 표시와 기록이 어긋난다.
    return save([...list, id]);
}

/** 아직 안 본 공지만 골라낸다 */
function unseenOf(notices, seenIds) {
    const seen = new Set(seenIds || readSeen());
    return (notices || []).filter((n) => n && n.id && !seen.has(n.id));
}

window.noticeSeen = { SEEN_KEY, readSeen, writeSeen, markSeen, unseenOf };
