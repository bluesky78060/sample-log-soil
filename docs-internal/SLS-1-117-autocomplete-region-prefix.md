# SLS-1-117 — 필지 주소 자동완성: 리(里) 단독 입력 시 기본 시·도 우선 검색

- **티켓**: SLS-1-117
- **작성일**: 2026-06-09
- **유형**: 버그 수정 (BUG / 자동완성)
- **상태**: done (커밋 `3b8eac8`, 미릴리스 — 다음 패치 v1.7.7 예정)

---

## 증상 (사용자 보고)

> 필지 주소 자동완성에서 **읍·면을 같이 입력하지 않으면 검색이 안 되는 리(里)가 있다.**

- "봉화읍 삼계리" → 정상 자동완성
- "삼계리" (리 이름만) → 자동완성 목록에 우리 지역(봉화군)이 안 뜸

## 근본 원인 (JUSO API 실측으로 확정)

자동완성은 JUSO(도로명주소) API에 키워드를 그대로 보내 **지번 단위 결과**를 받는다.
리 이름만 검색하면 **전국의 같은 이름 리**가 결과를 채우고, JUSO 요청은 한 번에 최대 50건(`countPerPage=50`)만 받으므로 사용자 지역이 상위 50건 밖으로 밀려나면 누락된다.

| 검색어 | 전체 건수 | 상위 50건 시·군 분포 | 봉화군 포함 |
| --- | --- | --- | --- |
| `삼계리` | 3,165 | 경기 용인시 처인구 47건, 충남 보령 1, 경북 영덕 1, 경기 평택 1 | ❌ 없음 |
| `봉화읍 삼계리` | 249 | 경상북도 봉화군 50건 | ✅ |
| `경상북도 삼계리` | 604 | 경상북도(봉화군 포함) | ✅ |

→ "리 단독 키워드로는 JUSO가 결과를 못 준다"가 아니라, **전국 동명 리가 50건 상한을 채워 우리 지역이 누락**되는 것이 핵심.

## 해결

리 이름만 입력한 경우(시·도/시·군 미포함), **설정의 기본 시·도(`app_default_sido`)를 검색어에 자동으로 prefix**해 검색 범위를 좁힌다.

- `삼계리` → 내부적으로 `경상북도 삼계리`로 검색 → 봉화군 포함
- `봉화읍 삼계리`, `경상북도 봉화군 삼계리` 등 시·도/읍면 포함 입력 → **그대로**(이중 prefix 방지)
- 기본 시·도 **미설정** 기관 → 기존처럼 전국 검색(동작 변화 없음)

설계 결정(사용자 확인): "기본 시·도 안에서 우선 검색". 타 시·도 리는 `충청남도 OO리`처럼 시·도를 함께 입력.

## 변경 파일

| 파일 | 변경 |
| --- | --- |
| `src/shared/autocomplete-manager.js` | `extractVillageAndLot`에 `isBareVillage` 플래그 추가, `getDefaultRegion()`·`buildJusoSearchKey()` 신규. input 핸들러 + Enter 폴백(`searchAndRenderJuso`)에 일관 적용, 캐시 키도 prefix된 검색어로 정규화(시·도별 캐시 격리) |
| `tests/unit/autocomplete-search-key.test.js` | 신규 — `isBareVillage` 판별, prefix 3분기, 회귀(복합 입력 prefix 안 함), 이중 prefix 방지 (11건) |
| `bind` 호출부(`src/soil/soil-script.js`) | **변경 없음** (회귀 위험 최소화) |

### 핵심 로직

```js
// 리/동 단독(+산/지번) 입력만 isBareVillage=true (^...$ 앵커로 복합 입력 오탐 차단)
function extractVillageAndLot(value) { /* ... isBareVillage ... */ }

function buildJusoSearchKey(parsed, defaultRegion) {
  const village = parsed?.village || '';
  const region = defaultRegion != null ? defaultRegion : getDefaultRegion();
  if (parsed?.isBareVillage && region) return `${region} ${village}`.trim();
  return village;            // 복합 입력·기본 시도 미설정이면 그대로
}
```

## 검증

- **ESLint**: 0 error
- **단위 테스트**: 165건 통과 (신규 11건)
- **JUSO API 실측**: 수정 전 `삼계리` 봉화 누락 → 수정 로직이 생성하는 `경상북도 삼계리`에서 봉화 포함 확인
- **코드 리뷰(opus)**: APPROVE — CRITICAL 0 / MAJOR 0 / MINOR 1 / SUGGESTION 3

## 전제 조건 (운영 안내)

이 수정이 효과를 보려면 **설정 → 기본 시·도**가 지정돼 있어야 한다(봉화군이면 "경상북도").
미설정 시에는 기존처럼 읍·면을 함께 입력해야 한다. (전국 배포 일반화 맥락: 각 기관이 자기 시·도 설정)

## 후속 과제 (비차단, 단일 앱 구조에서 보류)

- **[MINOR] 결합도**: 공통 모듈 `autocomplete-manager.js`가 앱 특정 키 `app_default_sido`를 직접 읽음 → `bind` 옵션으로 `getDefaultRegion` 주입하면 시료 타입별 오버라이드 가능
- **[SUGGESTION] 성능**: 입력마다 `localStorage.getItem` 동기 조회 → `bind` 시 1회 캐싱
- **[SUGGESTION] 견고성(선택)**: 기본 시·도 prefix 검색 결과 0이면 전국 폴백 재검색(현재는 미적용 — 타 시·도는 시·도 직접 입력)
