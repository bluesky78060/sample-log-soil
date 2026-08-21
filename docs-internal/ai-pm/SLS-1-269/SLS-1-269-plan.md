# SLS-1-269 플랜 — extract-whatsnew flaky 제거

## 대상

| 파일 | 작업 |
| --- | --- |
| `scripts/extract-whatsnew.js` | `extract(root)`를 꺼내고 CLI 껍데기를 분리 (**동작 불변**) |
| `tests/unit/extract-whatsnew.test.js` | 8건을 in-process 호출로, 1건은 프로세스 실행 유지 |

## 스크립트 리팩터

현재는 모듈 최상단에서 `main()`을 즉시 부르고, 실패 시 `process.exit(1)`한다.
**in-process로 부르면 테스트 러너가 죽는다.**

```js
// 결과를 반환한다 — 함수 안에서 process.exit을 부르지 않는다
function extract(root = ROOT) {
    // …읽기·파싱·판정…
    // 실패: { ok: false, error: '...', detail: [...] }
    // 성공: { ok: true, payload, outFile, summary }
    //        (성공 시 whatsnew-data.js까지 쓴다 — 테스트가 산출물을 검사한다)
}

function main() {
    const r = extract();
    if (!r.ok) { console.error(r.error); r.detail.forEach(d => console.error(d)); process.exit(1); }
    console.log(r.summary);
}

if (require.main === module) main();       // ← CLI로 부를 때만 실행
module.exports = { extract, normalizeVersion };
```

`require.main === module` 가드가 핵심이다. 이것이 없으면 테스트가 `require`하는 순간
저장소 실제 파일에 대고 스크립트가 돌아 **`src/shared/whatsnew-data.js`를 덮어쓴다.**

경로도 인자로 받아야 한다 — 현재는 `__dirname` 기준 상수라 임시 디렉터리를 가리킬 수 없다.

## 테스트 전환

```js
const { extract } = require('../../scripts/extract-whatsnew.js')   // jsdom 1회 로드

function runInProcess({ releaseHtml, version }) {
    const dir = makeFixture({ releaseHtml, version })   // 파일은 그대로 만든다
    const r = extract(dir)
    return { ok: r.ok, out: readOut(dir) }
}
```

**픽스처 파일 생성은 유지한다.** 스크립트가 파일에서 읽는다는 계약을 그대로 두는 편이
메모리 스텁으로 바꾸는 것보다 실제에 가깝다. 없애는 것은 **프로세스 기동뿐**이다.

### 프로세스로 남기는 1건

```
16. package.json 버전 항목이 릴리스 노트에 없으면 실패한다
```

CLAUDE.md의 "릴리스 노트 먼저 추가" 규약을 기계적으로 강제하는 것이 **종료 코드 1**이다.
in-process로 바꾸면 그 계약이 무검증이 된다. `execFileSync`를 그대로 둔다.
(이 1건에는 넉넉한 타임아웃을 개별 지정한다 — 프로세스 비용은 남으므로.)

## 실행 순서

1. 스크립트 리팩터 → `npm run build`로 동작 불변 확인
2. 테스트 전환 → 소요 시간 재측정
3. **변이 검증**
   - (a) `require.main === module` 가드 제거 → 테스트가 저장소 파일을 오염시키는지
   - (b) 버전 누락 검사 제거 → 16번(프로세스)이 죽는가
   - (c) `data-popup` 판정을 뒤집기 → in-process 테스트들이 죽는가
4. **부하 재현** — E2E를 백그라운드로 돌리며 단위 테스트 **연속 5회**
5. 전체 회귀 → 리뷰 → 승인

## 완료 조건

- [ ] 부하 상태에서 단위 테스트 5회 연속 전부 통과
- [ ] `npm run build` 정상, `whatsnew-data.js` 내용이 리팩터 전과 동일
- [ ] 변이 (a)(b)(c) 각각 실제로 실패
- [ ] 타임아웃 상향으로 덮지 않았다
