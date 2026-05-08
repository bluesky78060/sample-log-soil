/**
 * @fileoverview 네트워크 접근 제어 설정 (예시 파일)
 * @description 이 파일을 network-config.js로 복사한 후 실제 IP로 수정하세요.
 *              network-config.js는 .gitignore에 의해 git에 커밋되지 않습니다.
 *
 * 사용법:
 *   cp network-config.example.js network-config.js
 *   그 후 ALLOWED_GATEWAY 값을 실제 게이트웨이 IP로 변경
 */

// 허용된 게이트웨이 IP 주소 (이 서브넷에서만 웹 접근 허용)
// 예: '192.168.1.1' → 192.168.1.x 서브넷 전체 허용
window.NETWORK_CONFIG = {
    ALLOWED_GATEWAY: '0.0.0.0'  // 실제 게이트웨이 IP로 변경하세요
};
