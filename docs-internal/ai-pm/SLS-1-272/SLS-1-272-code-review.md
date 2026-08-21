# SLS-1-272 릴리스 리뷰 — v1.14.12

- 리뷰어: **codex (codex-cli 0.147.0, provider openai)** — 독립 레인
- 일시: 2026-08-21
- 대상: `src/release/index.html`, `package.json`, `src/shared/constants.js`, `src/index.html`,
  `tests/unit/release-notes-privacy.test.js`
- 판정: **APPROVED (지적 전건 반영 후)**

## 심각도 집계

| 심각도 | 건수 | 처리 |
| --- | --- | --- |
| CRITICAL | 0 | — |
| MAJOR | 1 | **수정 완료** |
| MINOR | 1 | **수정 완료** |
| SUGGESTION | 1 | **수정 완료** |

## MAJOR-1 — 릴리스 노트 세 번째 항목이 사실과 달랐다 (삭제함)

초안에 이렇게 썼다.

> 토양 화면의 쓰지 않던 '가져오기' 버튼을 정리했습니다. … 지금은 **검정결과 가져오기**를 쓰시면 됩니다.

**틀렸다.** `ca40609`(SLS-1-224)가 지운 것은 **`hidden` 속성이 붙은 요소들**뿐이다.

```html
<!-- ca40609이 지운 것 — 전부 화면 비표시였다 -->
- <input type="file" id="excelImportInput" ... hidden>
- <label for="excelImportInput" hidden></label>
- <div id="excelImportModal" class="modal hidden">
```

화면에 보이는 가져오기 버튼은 `soil/index.html:117`의 `#soilImportBtn`이고 **그대로 남아 있다**
(`SoilResultImporter`를 연다). 게다가 "검정결과 가져오기"라는 이름의 기능은 토양 화면에 없다.

→ **이 릴리스에는 사용자 눈에 보이는 UI 변화가 없다.** 항목을 통째로 삭제했다.
   내부 정리는 릴리스 노트에 넣지 않는다.

> 왜 이런 오류가 났나 — 커밋 제목("휴면 레거시 … 경로 제거")만 읽고 화면이 바뀌었다고 단정했다.
> `hidden` 여부를 확인하지 않았다. **릴리스 노트는 커밋 제목이 아니라 diff를 보고 써야 한다.**

## MINOR-1 — "걸러내고"가 부정확했다 (수정함)

큰 접수번호를 **저장에서 거부하는 것이 아니라**, 자동 채번의 최대값 계산에서 제외하고
정합성 점검에 표시한다.

→ "다음 번호를 매길 때 빼고 세며, 설정의 **접수번호 정합성 점검**에서도 사유와 함께
   보여 드립니다"로 고쳤다. 사용자가 찾아갈 화면 이름을 명시했다.

## SUGGESTION-1 — "같은 구분"을 구체화 (수정함)

담당자에게는 "같은 **경지구분** 안에서"가 명확하다. 반영했다.

## 리뷰어가 확인해 준 것

- `badge-latest`와 `version-dot.latest`가 v1.14.12에 하나씩 있고 v1.14.11에서 제거됐다
- 버전 3곳(`package.json` · `constants.js` · `src/index.html`)이 전부 `1.14.12`로 일치
- `208cee2`의 실제 수정 내용(Infinity 채번 오염 차단, 중복 증가 검사의 레코드 단위 보정,
  작물 분할 반영)이 릴리스 노트 앞 두 항목과 일치
- `data-popup` 미부착 판단이 타당

## 단위 테스트 1건 실패 → 설계된 가드였다

`release-notes-privacy.test.js`의 "배포 이력이 줄지 않았다"가 `expected 60 to be 59`로 실패했다.
**결함이 아니라 릴리스마다 함께 올리도록 만든 가드**다 (테스트 주석에 명시:
"릴리스마다 이 숫자를 함께 올린다"). 버전 카드가 통째로 사라지면 그 버전 사용자가 자기
항목을 못 찾게 되는 것을 막는 장치다. `59 → 60`으로 갱신했다.

## 검증

| 항목 | 결과 |
| --- | --- |
| `npm run build` | ✓ built in 1.99s. `extract-whatsnew` 1.14.12 기준 통과 — **릴리스 노트에 해당 버전 항목이 없으면 빌드가 실패**하는 규약을 통과했다 |
| `npm test` (E2E) | **437 passed** |
| `npm run test:unit` | **863 passed** (56 파일) |
| `npm run lint` | 0 errors, 6 warnings (전부 기존) |
| `npm run capture:manual` | 15 passed, 설명서 캡처 13개 갱신 후 재빌드 → `docs/manual/images`가 `src`와 일치함을 `cmp`로 확인 |

## 결론

MAJOR 1건은 **사용자에게 나갈 잘못된 안내**였고 배포 전에 잡혔다. 전건 반영 후 승인.
