# SLS-1-281 플랜 — 시험이 새 계약을 말하게 한다

> 정본. 훅 통과용 사본은 `docs/01-plan/`.

## 지금 시험이 단정하는 것

```js
expect(spans.separator, '이름을 섞었는데 구분선이 없다').toBeGreaterThan(0);
expect(spans.filler).toBe(spans.visible);      // ← 낡았다
expect(spans.filler).toBe(spans.separator);    // ← 유효하다
```

셋째 줄이 **SLS-1-276의 본래 목적**이다(두 행이 같은 계산을 공유한다). 그대로 둔다.

## 바꿀 것

둘째 줄을 SLS-1-280의 계약으로 교체하고, 그 논지를 시험이 직접 말하게 한다.

```js
expect(spans.filler).toBe(spans.headerCells);          // 머리글 총수 = 새 계약
expect(spans.filler).toBeGreaterThanOrEqual(spans.visible);  // 모자라지 않는다
```

`headerCells`(숨김 포함 전체 `th` 수)를 측정에 추가한다.

**둘째 단정을 함께 두는 이유**: 첫째만 있으면 "22와 같다"는 상수 확인에 그친다.
`>= visible`은 SLS-1-280이 막으려던 **바로 그 고장**(모자라서 끝 열에 닿지 않는다)을
직접 본다 — 열 구성이 바뀌어 머리글이 늘어도 계속 유효하다.

## 검증

- 해당 스펙 통과 + 전체 E2E 초록
- 변이 검증: 구현을 "보이는 열만"으로 되돌리면 `>= visible`은 통과하지만
  `=== headerCells`가 실패해야 한다 (전체 보기에서 17 vs 22)

## 하지 않을 것

구현(`_columnSpan()`)은 건드리지 않는다. SLS-1-280의 판단이 옳다.
