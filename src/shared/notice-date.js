// 공지 만료 판정용 날짜 유틸 (SLS-1-219)
//
// ⚠️ 이 파일이 존재하는 이유: 팝업(notice-popup.js)과 관리자 목록(admin-script.js)이
//    각자 날짜를 계산하다가 **기준이 어긋났다.**
//      팝업     — getFullYear/getMonth/getDate (로컬)
//      관리자   — new Date().toISOString().slice(0,10) (UTC)
//    KST(UTC+9)에서는 매일 00:00~08:59에 두 값이 하루 차이 난다. 그 구간에 사용자
//    팝업은 이미 만료 처리했는데 관리자 화면은 "아직 활성"으로 보여, 관리자가
//    만료된 긴급 공지를 방치하거나 살아있는 공지를 지우는 오판을 하게 된다.
//
// 사용자가 보는 날짜(로컬)를 기준으로 삼는다. 관리자가 입력하는 `until`도
// <input type="date">라 로컬 달력 날짜다.

/** 오늘을 'YYYY-MM-DD'로 (로컬 기준) — until과 문자열 비교한다 */
function noticeTodayStr(now = new Date()) {
    const p = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/**
 * 공지가 만료됐는지. until이 없으면 무기한이므로 절대 만료되지 않는다.
 * until 당일은 아직 유효하다(<=).
 */
function isNoticeExpired(until, today = noticeTodayStr()) {
    if (!until) return false;
    return today > until;
}

window.noticeTodayStr = noticeTodayStr;
window.isNoticeExpired = isNoticeExpired;
