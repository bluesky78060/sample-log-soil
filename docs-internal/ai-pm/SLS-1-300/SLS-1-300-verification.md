# SLS-1-300 검증 기록 (작성자 실행 — 리뷰 판정이 아니다)

## 실행 결과 (2026-11-26)
- 단위 `npm run test:unit`: 64 files / 1018 tests passed (신규 `xlsx-package.test.js` 14건 포함)
- lint `npm run lint`: 0 errors / 6 warnings(`--max-warnings 6` 이내, 기존 경고), 변경 파일 경고 0
- typecheck: 스크립트 없음(SLS-1-166 에서 제거)
- 빌드 `npm run build`: 성공
- E2E `npx playwright test`: 506 passed (신규 8번 포함)

## 변이 검증 — `tests/unit/xlsx-package.test.js`
| 변이 | 실패한 테스트 |
| --- | --- |
| 순서 predicate 제거 | 순서만 어긋남 → 던진다 (1) |
| bin predicate 제거 | bin 선언만 남음 → 던진다 (1) |
| 재검증 throw 제거 | 위 두 테스트 (2) |
| bin 삭제 변환 제거 | 보정 결과·결합·퇴비 exportFile (5) |
| CT 를 맨 뒤에 쓰기 | 보정 결과·결합·퇴비 exportFile (6) |
| 토양 / 공익직불제 호출부 제거 | 호출부 테스트 (각 1) |
| 퇴비 호출부 제거 | 퇴비 exportFile 실행 테스트 (1) |
| 두 entry import 제거 | entry 테스트 (각 1) |

E2E 8번: HEAD 번들(보정 전)로 되돌리면 실패(첫 엔트리 `xl/_rels/workbook.xml.rels`), 새 번들은 통과.

## docs 번들 비교 (HEAD 대비)
- 빌드 입력: 메인 체크아웃의 `src/shared/network-config.js`(gitignore 대상, `ALLOWED_GATEWAY: ''`). HEAD 번들 값도 `""`.
- 게이트웨이 값이 든 `storage-manager-*.js`: HEAD 와 바이트 동일.
- 바뀐 청크 3개를 짧은 식별자 정규화 뒤 비교: 세 호출부의 `window.finalizeXlsxPackage` 와 공유 청크(`heuktoram-result-importer-*`)에 들어간 보정 함수 본문 외에는 minifier 이름 재배정뿐.
- sync-version 부산물(설명서 날짜 배지 2곳)은 원복.

## 한계
실제 흙토람 업로드는 시험하지 않았다 — 소유자 확인이 필요하다.
