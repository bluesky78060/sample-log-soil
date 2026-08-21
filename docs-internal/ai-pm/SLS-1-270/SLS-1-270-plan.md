# SLS-1-270 플랜 — 혼합 접수번호 채번

## 대상

| 파일 | 작업 |
| --- | --- |
| `src/shared/excel-import-manager.js` | `_autoAssignReceptionNumbers` 교체 |
| `tests/e2e/compost-import-flow.spec.js` | 케이스 7을 새 동작으로 갱신 |

## 현재 코드의 문제 3가지

```js
_autoAssignReceptionNumbers() {
    const hasReceptionNumbers = this._parsedLogs.some(l => l.receptionNumber !== '');
    if (hasReceptionNumbers) return;                      // ① 한 행만 있어도 전체 포기
    …
    if (!isNaN(n) && n > maxNum) maxNum = n;               // ② Infinity 통과
    …
    this._parsedLogs.forEach((l, i) => {
        l.receptionNumber = String(maxNum + i + 1);        // ③ 명시 번호도 덮어씀
    });
}
```

① 혼합 입력에서 빈 행이 빈 채로 남는다 — 이 티켓의 본체
② `parseInt('400자리')` → `Infinity`. soil은 SLS-1-223에서 `Number.isSafeInteger`로
   고쳤으나 **공용 모듈은 그대로였다.** 같은 결함을 두 곳에 남겨 둘 이유가 없다
③ ①의 조기 반환 때문에 현재는 도달하지 않지만, ①을 고치면 **드러난다.**
   빈 행만 채워야 한다

## 바꿀 코드

```js
_autoAssignReceptionNumbers() {
    const isBlank = (v) => String(v ?? '').trim() === '';
    const blanks = this._parsedLogs.filter((l) => isBlank(l.receptionNumber));
    if (blanks.length === 0) return;          // 전 행에 번호가 있으면 그대로 둔다

    const existingLogs = this.config.getExistingLogs ? this.config.getExistingLogs() : [];
    const extractFn = this.config.autoNumberExtract;
    const filterFn = this.config.autoNumberFilter;
    const numberOf = (log) => (extractFn ? extractFn(log) : parseInt(log.receptionNumber, 10));

    let maxNum = 0;
    const consider = (raw) => {
        // extractFn이 숫자 문자열을 주던 기존 호환을 지킨다 (!isNaN('5')는 참이었다)
        const n = typeof raw === 'number' ? raw : parseInt(raw, 10);
        // parseInt('400자리')는 Infinity가 된다 (soil의 SLS-1-223과 같은 방어)
        if (Number.isSafeInteger(n) && n > maxNum) maxNum = n;
    };
    const inScope = (log) => !filterFn || filterFn(log);

    existingLogs.forEach((log) => {
        if (!log.receptionNumber) return;
        if (!inScope(log)) return;
        consider(numberOf(log));
    });
    // 같은 배치에서 사용자가 직접 적은 번호도 점유로 본다 — 기준을 기존 로그와 맞춘다
    this._parsedLogs.forEach((l) => {
        if (isBlank(l.receptionNumber)) return;
        if (!inScope(l)) return;
        consider(numberOf(l));
    });

    let next = maxNum;
    for (const l of blanks) {
        next += 1;
        if (!Number.isSafeInteger(next)) {
            // 조용히 자르지 않는다 — 남은 행은 빈 채로 두고 사용자에게 알린다
            warnings.push(`접수번호가 안전한 범위를 넘어 ${…}건은 번호를 매기지 못했습니다.`);
            break;
        }
        l.receptionNumber = String(next);
    }
}
```

### 충돌 회피를 Set 없이 하는 이유

`next`가 **기존 ∪ 배치 명시 번호의 최대값 위에서 시작**하므로 충돌이 구조적으로 불가능하다.
점유 Set을 두고 `while (used.has(next))`를 도는 코드는 **절대 참이 되지 않는 조건**이라
죽은 코드가 된다. 이 저장소는 죽은 단언으로 이미 한 번 데인 적이 있다(SLS-1-223 MINOR).

## 동작 대조표

| 입력 | 현재 | 수정 후 |
| --- | --- | --- |
| 전 행 번호 없음 (기존 최대 100) | 101, 102, 103 | **동일** |
| 전 행 번호 있음 | 전부 보존 | **동일** |
| 일부만 있음 (기존 최대 100, 명시 201) | `201`, `''` | `201`, **`202`** |
| 400자리 번호 섞임 | 이후 번호가 `Infinity` 오염 | 그 번호는 최대값 계산에서 제외 |
| 번호가 `'   '` | 번호로 취급 → 채번 건너뜀 | **빈 칸으로 보고 채운다** |

## 테스트

케이스 7을 갱신한다 (제목도 바꾼다 — 더 이상 "현재 동작"이 아니다).

```js
test('7. 접수번호가 일부 행에만 있으면 나머지는 이어지는 번호로 채워진다', …)
  입력: ['201', ROW_A], ['', ROW_B]
  미리보기: ['201', '202']
  저장:    [{봉화농장,'201'}, {영주농장,'202'}]   ← 이 배치에서는 정렬 역전이 나오지 않는다
```

정렬 역전이 **이 경로에서** 사라지는 것은 부수 효과다. 빈 번호가 생기지 않으면
`parseInt('') || 0`이 발동할 대상이 없다. **다만 과거에 저장된 빈 번호 레코드에는
그대로 남는다**(s-1). 정렬 코드는 건드리지 않고 별도 티켓으로 넘긴다.

### 유닛 테스트 신설 — E2E가 못 닿는 곳

`autoNumberExtract` / `autoNumberFilter`는 **현재 어떤 소비자도 설정하지 않는다.**
compost를 통한 E2E로는 이 분기에 닿을 수 없다. `tests/unit/excel-import-numbering.test.js`를
만들어 클래스를 직접 세우고 `_autoAssignReceptionNumbers`를 호출한다.

덮을 것: 전부 빈 칸 / 전부 채움 / 혼합 / `'   '` / 400자리(Infinity) /
`extractFn`이 숫자 문자열 반환 / `filterFn`으로 네임스페이스 분리 /
`MAX_SAFE_INTEGER` 경계에서 경고 후 중단.

## 플랜 리뷰 반영 (codex, 2026-08-21)

MAJOR 2 · MINOR 3 · SUGGESTION 1을 받아 전건 반영했다.

**M-1. `filterFn`으로 제외된 기존 번호와 충돌할 수 있다.**
초안은 기존 로그에는 `filterFn`을 적용하면서 **배치 명시 번호에는 적용하지 않았다.**
기준이 어긋나 최대값이 잘못 나온다.

→ 배치 행에도 같은 `filterFn`을 적용해 **판정 기준을 하나로 만든다.**

> 다만 "다른 네임스페이스의 번호와 겹치는 것"은 결함이 아니라 **설계다.**
> `autoNumberFilter`는 성토(`F1`)와 일반(`1`)처럼 **별도 시퀀스**를 두기 위한 훅이다.
> 같은 네임스페이스 안에서 충돌하지 않으면 된다. 현재 이 훅을 설정하는 소비자는
> 하나도 없다(soil은 SLS-1-224에서 이 모듈에서 떨어져 나갔다).

**M-2. `MAX_SAFE_INTEGER` 경계에서 안전하지 않은 번호가 나갈 수 있다.**
`next += 1`이 경계를 넘으면 `String()` 결과가 실제와 달라진다.

→ 안전 범위를 벗어나면 **채번을 멈추고 경고를 남긴다.** 조용히 잘라내지 않는다
(`_autoAssignReceptionNumbers(warnings)`로 경고 배열을 받는다).

**m-1. `extractFn`이 숫자 문자열을 반환하면 기존엔 통과했다.**
`!isNaN('5')`는 참이지만 `Number.isSafeInteger('5')`는 거짓이다. 호환이 깨진다.
→ 숫자가 아니면 `parseInt`로 한 번 강제한 뒤 판정한다.

**m-2. `trim()` 도입의 영향을 명시한다.** 접수번호가 `'   '`인 **파싱 행**은 이제
빈 칸으로 보고 채운다(의도한 개선). 기존 **저장 로그**의 `'   '`는 전과 같이
`parseInt` → `NaN`으로 무시된다.

**m-3. 입력 방어와 출력 방어를 분리한다.** 입력은 `Number.isSafeInteger`로 거르고,
출력은 M-2의 경계 검사로 막는다.

**s-1. 정렬 역전 문구를 정정한다.** "사라진다"는 틀렸다 — **새로 만들지 않을 뿐**
과거에 저장된 빈 번호에는 그대로 남는다. 별도 후속 티켓으로 추적한다.

## 실행 순서

1. 코드 수정 → 케이스 7 갱신
2. `npm run build && npx playwright test compost-import` → 8건 통과
3. **변이 검증**
   - (a) `blanks.length === 0` → `this._parsedLogs.some(...)` 원복 → 케이스 7 실패
   - (b) `Number.isSafeInteger` → `!isNaN` → 큰 번호 테스트로 확인
   - (c) `blanks.forEach` → `this._parsedLogs.forEach` (명시 번호 덮어쓰기) → 케이스 6 실패
4. 전체 회귀 → 리뷰 → 승인

## 완료 조건

- [ ] 케이스 5·6·7 통과, 5·6은 동작 변화 없음
- [ ] 변이 (a)(b)(c) 각각 실제로 실패
- [ ] E2E·단위·린트 회귀 없음
