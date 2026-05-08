#!/usr/bin/env python3
"""
농약명 영한 매핑 테이블 자동 생성 스크립트 (v3)

v1(difflib) + 이분 매칭 + 괄호 변형 + 최소 음성 정규화
"""
import json
import re
import urllib.request
import sys
import difflib
from pathlib import Path

ROOT = Path(__file__).parent.parent
ENV_FILE = ROOT / '.env.local'
PESTICIDE_DATA = ROOT / 'src' / 'shared' / 'pesticide-data.js'
OUTPUT_JSON = ROOT / 'src' / 'shared' / 'pesticide-name-map.json'
OUTPUT_JS = ROOT / 'src' / 'shared' / 'pesticide-name-map.js'
REPORT_TXT = ROOT / 'scripts' / 'pesticide-map-report.txt'
OVERRIDES_JSON = ROOT / 'scripts' / 'pesticide-manual-overrides.json'

def load_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().strip().split('\n'):
            if '=' in line:
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip()
    return env

# ========================================
# 한글 로마자 변환 (revised romanization 간이)
# ========================================
INITIALS = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
MEDIALS = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
FINALS = ['','k','k','ks','n','nj','nh','t','l','lk','lm','lb','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h']

def romanize_hangul(text):
    result = []
    for ch in text:
        code = ord(ch)
        if 0xAC00 <= code <= 0xD7A3:
            idx = code - 0xAC00
            initial = idx // 588
            medial = (idx % 588) // 28
            final = idx % 28
            result.append(INITIALS[initial] + MEDIALS[medial] + FINALS[final])
        elif ch.isalpha():
            result.append(ch.lower())
    return ''.join(result)

# ========================================
# 최소 음성 정규화 (양쪽 공통)
# Korean lacks ph/th/v/f/z sounds - apply only these
# ========================================
def normalize(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9]', '', s)
    # Korean이 표현 못 하는 음 → 한국어 근사치로
    s = s.replace('ph', 'p')    # 포스 = phos
    s = s.replace('th', 't')    # 티온 = thion (drops h)
    s = s.replace('f', 'p')     # fluron = 플루론
    s = s.replace('v', 'b')     # Vinclozolin = 빈클로졸린
    s = s.replace('z', 'j')     # diazinon = 다이아지논
    s = s.replace('l', 'r')     # l/r → r (Korean often uses r for final l)
    # 한글 필러 모음 제거 (으→eu는 거의 무음)
    s = s.replace('eu', '')
    s = s.replace('eo', 'o')
    # 중복 문자 단일화
    s = re.sub(r'(.)\1+', r'\1', s)
    return s

def length_penalty(a, b):
    """길이 차이 패널티 (0.0 ~ 1.0)"""
    if not a or not b:
        return 0.0
    return min(len(a), len(b)) / max(len(a), len(b))

def score(eng_norm, kor_roman_norm):
    """SequenceMatcher ratio * 길이 패널티"""
    base = difflib.SequenceMatcher(None, eng_norm, kor_roman_norm).ratio()
    # 길이 차이 많으면 패널티 (파라티온 vs parathionmethyl 같은 경우 방지)
    lp = length_penalty(eng_norm, kor_roman_norm)
    return base * (0.75 + 0.25 * lp)

# ========================================
# 영문 농약명 로드
# ========================================
def load_eng_names():
    content = PESTICIDE_DATA.read_text()
    return re.findall(r"engName:\s*'([^']+)'", content)

def eng_variants(name):
    """영문명의 매칭용 변형 생성
    주의: 하이픈 분리는 하지 않음 - '-methyl', '-ethyl', '-cis', '-trans' 등은 별개 농약
    """
    vs = []
    base = name.strip()
    vs.append(normalize(base))
    # 괄호 제거 버전: 'Chlorpyrifos(-ethyl)' → 'Chlorpyrifos'
    # 괄호 안이 하이픈으로 시작하면 '주 이름'을 가리키므로 괄호 제거한 것이 기본
    no_paren = re.sub(r'\([^)]*\)', '', base).strip()
    if no_paren and no_paren != base:
        n = normalize(no_paren)
        if n and n not in vs:
            vs.append(n)
    return [v for v in vs if v]

# ========================================
# API 한글 농약명 + MRL 건수
# ========================================
def load_kor_pesticides(api_key):
    all_rows = []
    for start in range(1, 25000, 1000):
        url = f'http://openapi.foodsafetykorea.go.kr/api/{api_key}/I1050/json/{start}/{start+999}'
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                data = json.loads(r.read())
        except Exception as e:
            print(f'  WARN: {start} 청크 실패: {e}', file=sys.stderr)
            break
        rows = data.get('I1050', {}).get('row', [])
        if not rows:
            break
        all_rows.extend(rows)

    kor_map = {}
    for r in all_rows:
        name = r.get('AGCHM_KOR_NM', '').strip()
        if not name or '？' in name or '?' in name:
            continue
        if name not in kor_map:
            # 괄호 안 제거 (예: 디디티(DDT) → 디디티)
            clean = re.sub(r'\([^)]*\)', '', name).strip()
            roman = romanize_hangul(clean)
            kor_map[name] = {
                'count': 0,
                'romanized': roman,
                'normalized': normalize(roman)
            }
        kor_map[name]['count'] += 1

    return kor_map, len(all_rows)

# ========================================
# 이분 매칭 (그리디 + 임계값)
# ========================================
def match_bipartite(eng_names, kor_map, threshold=0.60):
    """
    N:1 매칭: 여러 영문이 하나의 한글명에 매핑 가능
    (이성질체 cis/trans/R/S 등이 같은 한글명 공유)
    각 영문은 가장 높은 점수의 한글을 선택
    """
    eng_vars = {e: eng_variants(e) for e in eng_names}

    matches = {}
    for eng in eng_names:
        best = None
        best_score = 0
        for kor, info in kor_map.items():
            kor_norm = info['normalized']
            if not kor_norm:
                continue
            for ev in eng_vars[eng]:
                s = score(ev, kor_norm)
                if s > best_score:
                    best_score = s
                    best = kor
        if best and best_score >= threshold:
            matches[eng] = {
                'kor': best,
                'score': round(best_score, 3),
                'mrl_count': kor_map[best]['count'],
                'confidence': 'high' if best_score >= 0.85 else ('medium' if best_score >= 0.72 else 'low')
            }

    unmatched_eng = [e for e in eng_names if e not in matches]
    matched_kor = {m['kor'] for m in matches.values()}
    unmatched_kor = [
        {'kor': k, 'count': info['count'], 'romanized': info['romanized'], 'normalized': info['normalized']}
        for k, info in kor_map.items() if k not in matched_kor
    ]
    return matches, unmatched_eng, unmatched_kor

# ========================================
# 메인
# ========================================
def main():
    print('[1] 환경 변수 로드')
    env = load_env()
    api_key = env.get('FOODSAFETY_KEY')
    if not api_key:
        print('ERROR: FOODSAFETY_KEY 미설정', file=sys.stderr)
        sys.exit(1)

    print('[2] 프로젝트 영문 농약명 로드')
    eng_names = load_eng_names()
    print(f'  -> {len(eng_names)}종')

    print('[3] 식품안전나라 API에서 한글 농약명 수집')
    kor_map, total_rows = load_kor_pesticides(api_key)
    print(f'  -> 한글 농약: {len(kor_map)}종 / 전체 레코드: {total_rows}건')

    print('[4] 수동 오버라이드 로드')
    overrides = {}
    if OVERRIDES_JSON.exists():
        ov_raw = json.loads(OVERRIDES_JSON.read_text())
        overrides = {k: v for k, v in ov_raw.items() if not k.startswith('_') and v}
        print(f'  -> {len(overrides)}건 오버라이드')

    print('[5] 이분 매칭 (임계값: 0.60, difflib + 최소 음성 정규화)')
    matches, unmatched_eng, unmatched_kor = match_bipartite(eng_names, kor_map)

    # 오버라이드 적용 (자동 매칭 결과 덮어씀)
    override_applied = 0
    override_missing = []
    for eng, kor in overrides.items():
        if kor in kor_map:
            matches[eng] = {
                'kor': kor,
                'score': 1.0,
                'mrl_count': kor_map[kor]['count'],
                'confidence': 'manual'
            }
            override_applied += 1
        else:
            override_missing.append((eng, kor))
    print(f'  -> 오버라이드 적용: {override_applied}/{len(overrides)}')
    if override_missing:
        print(f'  -> 오버라이드 실패 (API DB에 한글명 없음):')
        for e, k in override_missing:
            print(f'     {e} -> {k}')

    # 미매칭 목록 재계산
    unmatched_eng = [e for e in eng_names if e not in matches]

    manual = sum(1 for m in matches.values() if m['confidence'] == 'manual')
    high = sum(1 for m in matches.values() if m['confidence'] == 'high')
    medium = sum(1 for m in matches.values() if m['confidence'] == 'medium')
    low = sum(1 for m in matches.values() if m['confidence'] == 'low')
    print(f'  -> 매칭: {len(matches)}/{len(eng_names)} (manual {manual}, high {high}, medium {medium}, low {low})')
    print(f'  -> 미매칭 영문: {len(unmatched_eng)}종')
    print(f'  -> 미매칭 한글: {len(unmatched_kor)}종')

    print('[6] 결과 저장')
    output = {
        'meta': {
            'generated_at': __import__('datetime').datetime.now().isoformat(),
            'source': 'foodsafetykorea.go.kr OpenAPI I1050',
            'algorithm': 'difflib + minimal phonetic normalization + N:1 + manual overrides',
            'eng_count': len(eng_names),
            'kor_count': len(kor_map),
            'matched': len(matches),
            'manual': manual,
            'high_confidence': high,
            'medium_confidence': medium,
            'low_confidence': low,
            'unmatched_eng': len(unmatched_eng),
            'unmatched_kor': len(unmatched_kor),
        },
        'map': matches
    }
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f'  -> {OUTPUT_JSON}')

    # JS 래퍼 파일 생성 (브라우저에서 <script> 태그로 로드 가능)
    js_content = (
        '// ========================================\n'
        '// 농약명 영한 매핑 테이블\n'
        '// 자동 생성: scripts/build-pesticide-name-map.py\n'
        '// 소스: 식품안전나라 OpenAPI I1050\n'
        '// ========================================\n'
        '// DO NOT EDIT MANUALLY - regenerate via script\n'
        '// 수동 오버라이드는 scripts/pesticide-manual-overrides.json 에서 수정\n'
        '\n'
        '(function() {\n'
        '    const PESTICIDE_NAME_MAP = ' + json.dumps(output, ensure_ascii=False, indent=4) + ';\n'
        '    if (typeof window !== "undefined") {\n'
        '        window.PESTICIDE_NAME_MAP = PESTICIDE_NAME_MAP;\n'
        '    }\n'
        '    if (typeof module !== "undefined" && module.exports) {\n'
        '        module.exports = PESTICIDE_NAME_MAP;\n'
        '    }\n'
        '})();\n'
    )
    OUTPUT_JS.write_text(js_content)
    print(f'  -> {OUTPUT_JS}')

    with open(REPORT_TXT, 'w') as f:
        f.write('=' * 70 + '\n')
        f.write('농약명 영한 매핑 리포트 (v3)\n')
        f.write('=' * 70 + '\n\n')
        f.write(f'전체 영문: {len(eng_names)}종 / 전체 한글(API): {len(kor_map)}종\n')
        f.write(f'매칭 성공: {len(matches)}종 (high {high}, medium {medium}, low {low})\n')
        f.write(f'미매칭 영문: {len(unmatched_eng)}종 / 미매칭 한글: {len(unmatched_kor)}종\n')
        f.write(f'매칭률: {100*len(matches)/len(eng_names):.1f}%\n\n')

        for label, conf in [('MANUAL OVERRIDE', 'manual'), ('HIGH (>=0.85)', 'high'), ('MEDIUM (0.72~0.85)', 'medium'), ('LOW (0.60~0.72)', 'low')]:
            f.write('=' * 70 + '\n')
            f.write(f'{label} CONFIDENCE 매칭\n')
            f.write('=' * 70 + '\n')
            items = sorted([(e, m) for e, m in matches.items() if m['confidence'] == conf])
            for eng, m in items:
                f.write(f"  {eng:42s} -> {m['kor']:25s} ({m['score']}, {m['mrl_count']}건)\n")
            f.write(f'  --> 총 {len(items)}건\n\n')

        f.write('=' * 70 + '\n')
        f.write(f'미매칭 영문 ({len(unmatched_eng)}종)\n')
        f.write('=' * 70 + '\n')
        for e in sorted(unmatched_eng):
            f.write(f'  {e}\n')
        f.write('\n')

        f.write('=' * 70 + '\n')
        f.write(f'미매칭 한글 ({len(unmatched_kor)}종) - MRL 건수 많은 순 상위 100개\n')
        f.write('=' * 70 + '\n')
        for item in sorted(unmatched_kor, key=lambda x: -x['count'])[:100]:
            f.write(f"  {item['kor']:25s} ({item['count']}건)\n")

    print(f'  -> {REPORT_TXT}')
    print()
    print('[완료] 요약:')
    print(f'  매칭 성공률: {len(matches)}/{len(eng_names)} ({100*len(matches)/len(eng_names):.1f}%)')
    print(f'  high: {high}, medium: {medium}, low: {low}')

if __name__ == '__main__':
    main()
