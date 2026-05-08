// ========================================
// MRL API 모듈 (식품안전나라 OpenAPI)
// ========================================
// 서비스: I1050 (식품별 농약잔류허용기준)
// 출처: http://openapi.foodsafetykorea.go.kr
// 전체 ~18,129건 / 농약-식품 쌍으로 MRL 값 제공
// ========================================

/**
 * MrlApi - 식품안전나라 농약 잔류허용기준 API
 *
 * 사용 예:
 *   await MrlApi.init();                              // 캐시 로드/초기화
 *   await MrlApi.syncIfStale();                       // 캐시 만료 시 재다운로드
 *   const mrl = MrlApi.lookup('사과', '다이아지논');   // { value: 0.2, unit: 'mg/kg', ... }
 *   MrlApi.setApiKey('xxx');                          // 설정 페이지에서 키 저장
 */
const MrlApi = (function () {
    // ========================================
    // 상수
    // ========================================
    const SERVICE_ID = 'I1050';
    // HTTPS 사용 필수: Electron renderer CSP 및 웹 mixed content 정책 대응
    const BASE_URL = 'https://openapi.foodsafetykorea.go.kr/api';
    const CHUNK_SIZE = 1000;               // 한 번에 최대 1000건
    const MAX_RECORDS = 25000;             // 안전장치 (현재 ~18,000건)

    // localStorage 키
    const STORAGE_KEY_DATA = 'mrl_cache_data';        // 전체 데이터 인덱스
    const STORAGE_KEY_META = 'mrl_cache_meta';        // 메타(timestamp, total, version)
    const STORAGE_KEY_API_KEY = 'mrl_api_key';        // API 인증키

    // 캐시 TTL
    const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;     // 7일

    // 현재 스키마 버전 (캐시 호환성 체크용)
    const CACHE_SCHEMA_VERSION = 1;

    // ========================================
    // 내부 상태
    // ========================================
    // lookupMap: Map<`${crop}|${pesticide}`, RecordItem[]>
    // 동일 작물+농약 조합에 여러 기준이 있을 수 있어 배열
    let lookupMap = null;

    // 전체 원본 rows (필요 시 조회)
    let allRows = null;

    // 식품→중분류 매핑 (예: "기장" → "곡류(Cereal grains)")
    // foodToCategoryMap: Map<food_name, mid_category>
    let foodToCategoryMap = null;

    // 중분류→분류 식품 목록 (fallback 조회용)
    // 예: "곡류(Cereal grains)" → ["곡류", "곡류(쌀제외)"]
    let categoryFallbackMap = null;

    // 로드 완료 여부
    let isLoaded = false;

    // 동시 호출 방지용 Promise
    let syncPromise = null;

    // ========================================
    // 로깅 헬퍼
    // ========================================
    function log(level, ...args) {
        const logger = (typeof window !== 'undefined' && window.logger) || null;
        if (logger && typeof logger[level] === 'function') {
            logger[level]('[MrlApi]', ...args);
        } else if (level === 'error' || level === 'warn') {
            console[level]('[MrlApi]', ...args);
        }
    }

    // ========================================
    // API 키 관리
    // ========================================
    function getApiKey() {
        try {
            return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
        } catch (e) {
            log('warn', 'API 키 읽기 실패', e);
            return '';
        }
    }

    function setApiKey(key) {
        try {
            const trimmed = (key || '').trim();
            if (trimmed) {
                localStorage.setItem(STORAGE_KEY_API_KEY, trimmed);
            } else {
                localStorage.removeItem(STORAGE_KEY_API_KEY);
            }
            return true;
        } catch (e) {
            log('error', 'API 키 저장 실패', e);
            return false;
        }
    }

    function hasApiKey() {
        return !!getApiKey();
    }

    // ========================================
    // 문자열 정규화 (조회 키 생성)
    // ========================================
    // - 공백 제거, 소문자화
    // - 영문 괄호 "(Agricultural Products)" 등 부가 표기 제거
    function normalize(str) {
        if (!str) return '';
        return String(str)
            .replace(/\([^)]*\)/g, '')     // 괄호 안 제거
            .replace(/\s+/g, '')            // 공백 제거
            .toLowerCase();
    }

    // ========================================
    // 작물명 파싱 (의뢰물품 → 기본 작물명)
    // ========================================
    // 예시 입력:
    //   "사과 2kg"         → "사과"
    //   "사과(한라봉)"      → "사과"
    //   "사과 외 2종"       → "사과"
    //   "사과, 배"         → "사과" (첫 번째만)
    //   "사과 3포기"        → "사과"
    //   "볍씨 500g"        → "볍씨"
    //   "감자(수미) 1상자"  → "감자"
    function parseCropName(raw) {
        if (!raw) return '';
        let s = String(raw).trim();
        if (!s || s === '-') return '';

        // 1) 괄호 내용 제거 (여러 번)
        s = s.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '');

        // 2) "외 N종" 패턴 제거
        s = s.replace(/외\s*\d+\s*종/g, '');
        s = s.replace(/등\s*\d+\s*종/g, '');

        // 3) 쉼표/세미콜론/슬래시로 구분된 경우 첫 항목만
        const parts = s.split(/[,;\/]/);
        s = parts[0] || '';

        // 4) 수량 + 단위 제거 (예: "2kg", "1포기", "3상자", "500g", "100ml")
        //    단위 목록: kg, g, mg, ml, l, 포기, 상자, 박스, 개, 묶음, 봉, 포, 단, 다발, 송이, 개입, 톤
        //    \b는 한글 단어 경계에 동작 안 해서 사용 안 함 - 한글/영문/숫자가 뒤에 오지 않을 때만 매칭
        const UNIT_PATTERN = /\d+(\.\d+)?\s*(kg|mg|ml|ℓ|포기|상자|박스|묶음|다발|송이|개입|톤|개(?![\uAC00-\uD7A3a-zA-Z])|[glt](?![\uAC00-\uD7A3a-zA-Z])|봉(?![\uAC00-\uD7A3a-zA-Z])|포(?![\uAC00-\uD7A3a-zA-Z])|단(?![\uAC00-\uD7A3a-zA-Z]))/gi;
        s = s.replace(UNIT_PATTERN, '');

        // 5) 숫자만 남은 경우도 제거 (예: "사과 3개" 이미 처리됐지만 "사과 3" 같은 잔여)
        s = s.replace(/\d+(\.\d+)?/g, '');

        // 6) 앞뒤 공백/특수문자 정리
        s = s.replace(/^[\s,\-·•]+|[\s,\-·•]+$/g, '');

        return s.trim();
    }

    // ========================================
    // 작물 별명(alias) 매핑
    // ========================================
    // 식약처 DB에 없는 품종명/지역명을 등록된 식품명으로 변환
    // 키: 소문자 정규화된 품종명, 값: DB 등록 식품명
    const CROP_ALIAS_MAP = {
        // === 대두(콩) 품종 ===
        '서리태': '대두', '서리태콩': '대두', '서목태': '대두', '검정콩': '대두',
        '흰콩': '대두', '백태': '대두', '약콩': '대두', '쥐눈이콩': '대두',
        '노란콩': '대두', '콩나물콩': '대두', '장류콩': '대두', '나물콩': '대두',
        '메주콩': '대두', '청대콩': '대두', '콩': '대두', '작두콩': '대두',
        // === 기타 두류 ===
        '동부콩': '동부', '완두콩': '완두',
        // === 옥수수 품종 ===
        '찰옥수수': '옥수수', '단옥수수': '옥수수', '강낭옥수수': '옥수수',
        '초당옥수수': '옥수수', '풋옥수수': '옥수수', '보통옥수수': '옥수수',
        // === 보리 품종 ===
        '찰보리': '보리', '쌀보리': '보리', '겉보리': '보리', '맥주보리': '보리',
        // === 벼/쌀 ===
        '벼': '쌀', '밭벼': '쌀',
        // === 수수/기장/조 ===
        '찰수수': '수수', '찰기장': '기장', '차조': '조', '메조': '조',
        // === 고추 ===
        '청양고추': '고추', '아삭이고추': '고추', '풋고추': '고추', '홍고추': '고추',
        '꽈리고추': '고추', '오이고추': '고추', '당초': '고추',
        '건고추': '고추(건조)', '마른고추': '고추(건조)',
        // === 감귤류 ===
        '한라봉': '감귤', '천혜향': '감귤', '레드향': '감귤', '황금향': '감귤',
        '카라향': '감귤', '불지화': '감귤', '금귤': '감귤',
        '감귤만감': '감귤', '감귤온주': '감귤', '부지화': '감귤',
        // === 감 ===
        '단감': '감', '떫은감': '감',
        // === 토마토 ===
        '방울토마토': '토마토', '대추토마토': '토마토', '스테비아토마토': '토마토',
        '송이토마토': '토마토',
        // === 사과 ===
        '부사': '사과', '홍로': '사과', '아오리': '사과', '감홍': '사과',
        '추광': '사과', '시나노골드': '사과', '꽃사과': '사과',
        // === 배 ===
        '신고배': '배', '원황': '배', '황금배': '배', '돌배': '배',
        // === 복숭아 ===
        '개복숭아': '복숭아',
        // === 자두 ===
        '서양자두': '자두',
        // === 감자 ===
        '수미': '감자', '남작': '감자', '대서': '감자', '홍감자': '감자',
        // === 고구마 ===
        '밤고구마': '고구마', '꿀고구마': '고구마', '호박고구마': '고구마',
        // === 호박 ===
        '단호박': '호박', '맷돌호박': '호박', '애호박': '호박',
        '주키니호박': '호박', '밤호박': '호박', '수세미': '호박',
        // === 수박 ===
        '복수박': '수박', '애플수박': '수박',
        // === 기타 과채류 ===
        '파프리카': '피망', '울외': '참외',
        // === 파/부추 ===
        '쪽파': '파', '대파': '파', '실파': '파',
        '두메부추': '부추',
        // === 배추 ===
        '알배추': '배추', '봄배추': '배추', '김장배추': '배추',
        '얼갈이배추': '엇갈이배추', '방울양배추': '양배추',
        // === 무 ===
        '총각무': '무(뿌리)', '열무': '무(잎)', '알타리무': '무(뿌리)',
        '시래기용무': '무(잎)', '게걸무': '무(뿌리)',
        // === 미나리 ===
        '논미나리': '미나리', '밭미나리': '미나리',
        // === 비트 ===
        '비트': '비트(뿌리)',
        // === 팥/녹두 ===
        '적두': '팥', '거피팥': '팥',
        // === 들깨 ===
        '들깨': '들깻잎', '깻잎': '들깻잎', '잎들깨': '들깻잎',
        // === 마늘 ===
        '깐마늘': '마늘', '쪽마늘': '마늘', '다진마늘': '마늘',
        // === 포도 ===
        '샤인머스캣': '포도', '캠벨': '포도', '거봉': '포도', 'MBA': '포도', '산머루': '머루',
        // === 딸기 ===
        '설향': '딸기', '장희': '딸기', '나무딸기': '딸기',
        '블랙베리': '딸기', '라즈베리': '딸기',
        // === 블루베리 ===
        '하니베리': '블루베리', '허니베리': '블루베리', '하스카프': '블루베리',
        // === 키위 ===
        '참다래': '키위(참다래)', '골드키위': '키위(참다래)',
        // === 밤 ===
        '밤나무': '밤',
        // === 채소/엽채류 ===
        '로메인': '양상추', '치커리': '엽채류', '삼엽채': '엽채류', '엔다이브': '엽채류',
        '곤드레': '엽채류', '곰취': '엽채류', '갯방풍': '엽채류',
        '병풍취': '엽채류', '모시대': '엽채류', '누룩치': '엽채류',
        '고구마순': '엽경채류', '고비': '고사리',
        '쑥': '쑥갓', '개똥쑥': '쑥',
        '서양냉이': '냉이', '당아욱': '아욱',
        // === 허브/향신 ===
        '레몬밤': '허브류(생)', '페퍼민트': '민트', '스피아민트': '민트',
        '라벤더': '라벤더(생)',
        // === 약용/특용 ===
        '인삼': '수삼', '홍삼': '건삼', '묘삼': '수삼', '산양삼': '수삼',
        '당귀': '당귀(잎)', '둥글레': '둥글레(뿌리)',
        '산초나무': '산초(열매)', '마가목': '마가목(열매)',
        '꾸지뽕나무': '꾸지뽕(열매)',
    };

    /**
     * 작물 별명 적용: DB에 없는 품종명을 등록된 식품명으로 변환
     */
    function resolveCropAlias(cropName) {
        if (!cropName) return cropName;
        return CROP_ALIAS_MAP[cropName] || cropName;
    }

    function makeKey(crop, pesticide) {
        return normalize(crop) + '|' + normalize(pesticide);
    }

    // ========================================
    // 네트워크 호출 (단일 청크)
    // ========================================
    async function fetchChunk(key, start, end) {
        const url = `${BASE_URL}/${encodeURIComponent(key)}/${SERVICE_ID}/json/${start}/${end}`;
        const res = await fetch(url);

        // 인증 실패 시 서버가 text/html을 반환 (alert 스크립트)
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const text = await res.text();

        if (contentType.includes('text/html') || text.trim().startsWith('<')) {
            throw new Error('AUTH_INVALID: 인증키가 유효하지 않거나 활성화되지 않았습니다');
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            throw new Error('PARSE_ERROR: 응답 파싱 실패 - ' + text.slice(0, 100));
        }

        const payload = data && data[SERVICE_ID];
        if (!payload) {
            throw new Error('INVALID_RESPONSE: 응답 형식이 예상과 다릅니다');
        }

        const result = payload.RESULT;
        if (result && result.CODE && result.CODE !== 'INFO-000') {
            throw new Error(`API_ERROR[${result.CODE}]: ${result.MSG || 'Unknown'}`);
        }

        return {
            rows: payload.row || [],
            totalCount: parseInt(payload.total_count || '0', 10) || 0
        };
    }

    // ========================================
    // 전체 다운로드 (청크 반복)
    // ========================================
    async function downloadAll(onProgress) {
        const key = getApiKey();
        if (!key) {
            throw new Error('NO_API_KEY: API 인증키가 설정되지 않았습니다');
        }

        log('info', '전체 다운로드 시작');
        const collected = [];
        let total = 0;

        for (let start = 1; start <= MAX_RECORDS; start += CHUNK_SIZE) {
            const end = start + CHUNK_SIZE - 1;
            try {
                const chunk = await fetchChunk(key, start, end);
                if (start === 1) {
                    total = chunk.totalCount;
                    log('info', `전체 건수: ${total}`);
                }
                if (!chunk.rows.length) break;
                collected.push(...chunk.rows);

                if (typeof onProgress === 'function') {
                    onProgress({
                        loaded: collected.length,
                        total: total || collected.length
                    });
                }

                // 전체 건수 도달 시 조기 종료
                if (total && collected.length >= total) break;
            } catch (err) {
                log('error', `청크 ${start}~${end} 실패`, err);
                throw err;
            }
        }

        log('info', `다운로드 완료: ${collected.length}건`);
        return collected;
    }

    // ========================================
    // 인덱싱 (조회용 Map 생성)
    // ========================================
    function buildIndex(rows) {
        const map = new Map();
        const ftc = new Map();   // food → mid category
        const cfb = new Map();   // mid category → [fallback food names]

        for (const r of rows) {
            const crop = r.FOOD_KOR_NM;
            const pest = r.AGCHM_KOR_NM;
            const mid = r.MLSFC_NM || '';
            if (!crop || !pest) continue;

            // 조회 인덱스
            const k = makeKey(crop, pest);
            if (!map.has(k)) map.set(k, []);
            map.get(k).push(r);

            // 식품 → 중분류 매핑
            if (mid && !ftc.has(crop)) {
                ftc.set(crop, mid);
            }
        }

        // 중분류별 "분류 식품" 추출
        // 예: 중분류 "곡류(Cereal grains)" → 식품명 중 "곡류"를 포함하는 식품 = 분류 기준 식품
        const midCategories = new Set(ftc.values());
        for (const mid of midCategories) {
            const midKor = mid.split('(')[0].trim();  // "곡류(Cereal grains)" → "곡류"
            if (!midKor) continue;

            // 이 중분류에 속한 모든 식품
            const foodsInMid = [];
            for (const [food, m] of ftc.entries()) {
                if (m === mid) foodsInMid.push(food);
            }

            // 분류 식품 = 중분류 한글명을 포함하는 식품 (예: "곡류", "곡류(쌀제외)", "채소류")
            const fallbacks = foodsInMid.filter(f => f.includes(midKor) || midKor.includes(f));
            if (fallbacks.length > 0) {
                cfb.set(mid, fallbacks);
            }
        }

        foodToCategoryMap = ftc;
        categoryFallbackMap = cfb;

        log('info', `인덱스 구축: ${map.size}키, 식품→중분류 ${ftc.size}건, 분류 fallback ${cfb.size}건`);
        return map;
    }

    // ========================================
    // 캐시 저장/로드
    // ========================================
    function saveCache(rows) {
        try {
            // 데이터 크기 절감: 필요한 필드만 추출
            const slim = rows.map(r => ({
                food: r.FOOD_KOR_NM || '',
                pest: r.AGCHM_KOR_NM || '',
                mrl: r.MRL_VAL || '',
                lclas: r.LCLAS_NM || '',
                mlsfc: r.MLSFC_NM || '',
                step: r.STEP || '',
                tmpr: r.TMPR_STDR_APPLC_YN || ''
            }));

            localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(slim));
            localStorage.setItem(STORAGE_KEY_META, JSON.stringify({
                version: CACHE_SCHEMA_VERSION,
                timestamp: Date.now(),
                count: slim.length
            }));
            log('info', `캐시 저장: ${slim.length}건`);
            return true;
        } catch (e) {
            log('error', '캐시 저장 실패 (용량 초과 가능)', e);
            return false;
        }
    }

    function loadCache() {
        try {
            const metaRaw = localStorage.getItem(STORAGE_KEY_META);
            const dataRaw = localStorage.getItem(STORAGE_KEY_DATA);
            if (!metaRaw || !dataRaw) return null;

            const meta = JSON.parse(metaRaw);
            if (meta.version !== CACHE_SCHEMA_VERSION) {
                log('warn', '캐시 스키마 버전 불일치 - 무효화');
                clearCache();
                return null;
            }

            const slim = JSON.parse(dataRaw);
            // 슬림 → 표준 row 형태로 복원
            const rows = slim.map(s => ({
                FOOD_KOR_NM: s.food,
                AGCHM_KOR_NM: s.pest,
                MRL_VAL: s.mrl,
                LCLAS_NM: s.lclas,
                MLSFC_NM: s.mlsfc || '',
                STEP: s.step,
                TMPR_STDR_APPLC_YN: s.tmpr
            }));

            return { rows, meta };
        } catch (e) {
            log('warn', '캐시 로드 실패', e);
            return null;
        }
    }

    function clearCache() {
        try {
            localStorage.removeItem(STORAGE_KEY_DATA);
            localStorage.removeItem(STORAGE_KEY_META);
            lookupMap = null;
            allRows = null;
            foodToCategoryMap = null;
            categoryFallbackMap = null;
            isLoaded = false;
            log('info', '캐시 삭제');
            return true;
        } catch (e) {
            log('error', '캐시 삭제 실패', e);
            return false;
        }
    }

    function getCacheStatus() {
        try {
            const metaRaw = localStorage.getItem(STORAGE_KEY_META);
            if (!metaRaw) {
                return { cached: false, expired: null, count: 0, timestamp: null };
            }
            const meta = JSON.parse(metaRaw);
            const age = Date.now() - (meta.timestamp || 0);
            return {
                cached: true,
                expired: age > CACHE_TTL_MS,
                count: meta.count || 0,
                timestamp: meta.timestamp || null,
                ageMs: age
            };
        } catch (e) {
            return { cached: false, expired: null, count: 0, timestamp: null };
        }
    }

    // ========================================
    // 초기화 (캐시 로드만, 네트워크 X)
    // ========================================
    async function init() {
        if (isLoaded) return true;
        const loaded = loadCache();
        if (loaded && loaded.rows && loaded.rows.length) {
            allRows = loaded.rows;
            lookupMap = buildIndex(loaded.rows);
            isLoaded = true;
            log('info', `초기화 완료: ${loaded.rows.length}건 (캐시)`);
            return true;
        }
        log('info', '캐시 없음 - sync() 필요');
        return false;
    }

    // ========================================
    // 전체 동기화 (네트워크 다운로드 + 캐시 저장)
    // ========================================
    async function sync(onProgress) {
        // 동시 호출 방지
        if (syncPromise) return syncPromise;

        syncPromise = (async () => {
            try {
                const rows = await downloadAll(onProgress);
                allRows = rows;
                lookupMap = buildIndex(rows);
                isLoaded = true;
                saveCache(rows);
                return { success: true, count: rows.length };
            } catch (err) {
                log('error', '동기화 실패', err);
                return { success: false, error: err.message };
            } finally {
                syncPromise = null;
            }
        })();

        return syncPromise;
    }

    /**
     * 캐시가 만료됐거나 없으면 동기화
     */
    async function syncIfStale(onProgress) {
        const status = getCacheStatus();
        if (status.cached && !status.expired) {
            if (!isLoaded) await init();
            return { success: true, count: status.count, fromCache: true };
        }
        return await sync(onProgress);
    }

    // ========================================
    // 농약명 영한 매핑 (window.PESTICIDE_NAME_MAP)
    // ========================================
    /**
     * 영문 농약명 → 한글 농약명 변환
     * @param {string} engName 영문 농약명 (예: 'Diazinon', 'Parathion-methyl')
     * @returns {{kor: string, confidence: string, score: number}|null}
     */
    function engToKor(engName) {
        if (!engName) return null;
        const nameMap = (typeof window !== 'undefined' && window.PESTICIDE_NAME_MAP) || null;
        if (!nameMap || !nameMap.map) return null;
        const entry = nameMap.map[engName];
        if (!entry) return null;
        return {
            kor: entry.kor,
            confidence: entry.confidence,
            score: entry.score
        };
    }

    /**
     * 한글 또는 영문 농약명을 받아서 한글로 통일
     * 입력이 한글이면 그대로, 영문이면 매핑 테이블에서 변환
     */
    function resolvePesticideName(name) {
        if (!name) return null;
        // 한글 포함 여부 판단
        const hasKorean = /[\uAC00-\uD7A3]/.test(name);
        if (hasKorean) {
            return { kor: name, confidence: 'input', source: 'korean-input' };
        }
        // 영문으로 간주, 매핑 조회
        const mapped = engToKor(name);
        if (mapped) {
            return {
                kor: mapped.kor,
                confidence: mapped.confidence,
                source: 'name-map',
                score: mapped.score
            };
        }
        return null;
    }

    // ========================================
    // 조회
    // ========================================
    /**
     * @param {string} crop 작물명 (식품명)
     * @param {string} pesticide 농약명
     * @returns {object|null} { value, unit, records, exact } 또는 null
     */
    /**
     * 레코드 배열에서 가장 엄격한(작은) MRL 값 선택
     */
    function pickStrictest(records) {
        let minVal = null;
        let minRecord = null;
        for (const r of records) {
            const v = parseFloat(r.MRL_VAL);
            if (isNaN(v)) continue;
            if (minVal === null || v < minVal) {
                minVal = v;
                minRecord = r;
            }
        }
        return { minVal, minRecord };
    }

    /**
     * 중분류 fallback 조회: 개별 식품에 MRL이 없으면 분류 기준 식품으로 재조회
     * 예: "기장" 없으면 → "곡류", "곡류(쌀제외)" 순서로 시도
     */
    function lookupWithCategoryFallback(cropName, pesticide) {
        if (!foodToCategoryMap || !categoryFallbackMap) return null;

        // 이 식품의 중분류 찾기
        const mid = foodToCategoryMap.get(cropName);
        if (!mid) return null;

        // 해당 중분류의 분류 식품 목록 (fallback 대상)
        const fallbacks = categoryFallbackMap.get(mid);
        if (!fallbacks || !fallbacks.length) return null;

        // "(쌀제외)" 같은 제외 패턴 우선 적용
        // 제외 패턴이 아닌 일반 분류명이 더 포괄적이므로 나중에 시도
        const sorted = [...fallbacks].sort((a, b) => {
            // 제외 패턴 포함 → 먼저 (더 구체적)
            const aExclude = a.includes('제외') ? 0 : 1;
            const bExclude = b.includes('제외') ? 0 : 1;
            return aExclude - bExclude;
        });

        for (const fallbackCrop of sorted) {
            // 자기 자신은 건너뛰기
            if (fallbackCrop === cropName) continue;

            const k = makeKey(fallbackCrop, pesticide);
            const records = lookupMap.get(k);
            if (records && records.length) {
                return { records, fallbackCrop, mid };
            }
        }
        return null;
    }

    function lookup(crop, pesticide) {
        if (!isLoaded || !lookupMap) return null;
        if (!crop || !pesticide) return null;

        // 작물명 파싱 + 별명 적용 순서로 후보 생성
        // 예: "서리태 2kg" → ["서리태 2kg", "서리태", "대두"]
        const parsedCrop = parseCropName(crop);
        const aliasedCrop = resolveCropAlias(parsedCrop || crop);
        const cropCandidates = [crop];
        if (parsedCrop && parsedCrop !== crop) cropCandidates.push(parsedCrop);
        if (aliasedCrop && !cropCandidates.includes(aliasedCrop)) cropCandidates.push(aliasedCrop);

        // 1단계: 개별 식품 정확 매칭
        let records = null;
        let matchedCrop = crop;
        let matchLevel = 'exact';  // exact | parsed | category
        for (const c of cropCandidates) {
            const k = makeKey(c, pesticide);
            const r = lookupMap.get(k);
            if (r && r.length) {
                records = r;
                matchedCrop = c;
                matchLevel = c === crop ? 'exact' : (c === aliasedCrop ? 'alias' : 'parsed');
                break;
            }
        }

        // 2단계: 개별 매칭 실패 → 중분류 fallback (alias 적용 후 시도)
        if (!records) {
            const targetCrop = aliasedCrop || parsedCrop || crop;
            const fallback = lookupWithCategoryFallback(targetCrop, pesticide);
            if (fallback) {
                records = fallback.records;
                matchedCrop = fallback.fallbackCrop;
                matchLevel = 'category';
            }
        }

        if (!records || !records.length) return null;

        const { minVal, minRecord } = pickStrictest(records);

        return {
            value: minVal,
            unit: 'mg/kg',
            crop: minRecord ? minRecord.FOOD_KOR_NM : crop,
            pesticide: minRecord ? minRecord.AGCHM_KOR_NM : pesticide,
            category: minRecord ? minRecord.LCLAS_NM : '',
            midCategory: minRecord ? (minRecord.MLSFC_NM || '') : '',
            records: records,
            matchLevel: matchLevel,  // 'exact' | 'parsed' | 'category'
            exact: matchLevel === 'exact' || matchLevel === 'parsed'
        };
    }

    /**
     * 부분 일치 조회 (작물/농약명 검색)
     * @param {string} query 검색어
     * @param {string} field 'crop' | 'pesticide'
     * @param {number} limit 최대 반환 수
     * @returns {string[]} 매칭되는 이름 목록 (고유)
     */
    function searchNames(query, field = 'pesticide', limit = 20) {
        if (!isLoaded || !allRows) return [];
        if (!query) return [];

        const q = normalize(query);
        const key = field === 'crop' ? 'FOOD_KOR_NM' : 'AGCHM_KOR_NM';
        const set = new Set();

        for (const r of allRows) {
            const name = r[key];
            if (!name) continue;
            if (normalize(name).includes(q)) {
                set.add(name);
                if (set.size >= limit) break;
            }
        }

        return Array.from(set);
    }

    /**
     * 영문 농약명으로 조회 (매핑 테이블 경유)
     * @param {string} crop 작물명 (한글)
     * @param {string} engPesticide 영문 농약명 (예: 'Diazinon')
     * @returns {object|null} { value, unit, korPesticide, mappingConfidence, ... }
     */
    function lookupByEng(crop, engPesticide) {
        const mapped = engToKor(engPesticide);
        if (!mapped) {
            return {
                value: null,
                error: 'NO_MAPPING',
                engPesticide,
                message: '농약명 매핑 정보가 없습니다'
            };
        }
        const result = lookup(crop, mapped.kor);
        if (!result) {
            return {
                value: null,
                error: 'NO_MRL',
                engPesticide,
                korPesticide: mapped.kor,
                mappingConfidence: mapped.confidence,
                message: `${crop} + ${mapped.kor} MRL 기준 없음`
            };
        }
        return Object.assign({}, result, {
            engPesticide,
            korPesticide: mapped.kor,
            mappingConfidence: mapped.confidence,
            mappingScore: mapped.score
        });
    }

    /**
     * 유연 조회: 한글/영문 자동 판별
     */
    function lookupFlexible(crop, pesticideName) {
        const resolved = resolvePesticideName(pesticideName);
        if (!resolved) {
            return { value: null, error: 'NO_MAPPING', input: pesticideName };
        }
        const result = lookup(crop, resolved.kor);
        if (!result) {
            return {
                value: null,
                error: 'NO_MRL',
                input: pesticideName,
                korPesticide: resolved.kor,
                mappingConfidence: resolved.confidence
            };
        }
        return Object.assign({}, result, {
            input: pesticideName,
            korPesticide: resolved.kor,
            mappingConfidence: resolved.confidence
        });
    }

    /**
     * 특정 농약의 모든 식품별 MRL 조회
     */
    function getAllByPesticide(pesticide) {
        if (!isLoaded || !allRows) return [];
        const q = normalize(pesticide);
        return allRows.filter(r => normalize(r.AGCHM_KOR_NM) === q);
    }

    /**
     * 특정 식품의 모든 농약별 MRL 조회
     */
    function getAllByCrop(crop) {
        if (!isLoaded || !allRows) return [];
        const q = normalize(crop);
        return allRows.filter(r => normalize(r.FOOD_KOR_NM) === q);
    }

    // ========================================
    // 판정 헬퍼
    // ========================================
    /**
     * 검출량과 MRL 기준값 비교하여 판정
     * @param {number} detected 검출량 (mg/kg)
     * @param {number} mrl MRL 기준값 (mg/kg)
     * @returns {'pass'|'fail'|'unknown'}
     */
    function judge(detected, mrl) {
        if (mrl === null || mrl === undefined || isNaN(mrl)) return 'unknown';
        if (detected === null || detected === undefined || isNaN(detected)) return 'unknown';
        return Number(detected) <= Number(mrl) ? 'pass' : 'fail';
    }

    // ========================================
    // 공개 API
    // ========================================
    return {
        // 키 관리
        getApiKey,
        setApiKey,
        hasApiKey,

        // 초기화/동기화
        init,
        sync,
        syncIfStale,

        // 캐시 관리
        getCacheStatus,
        clearCache,

        // 조회
        lookup,
        lookupByEng,
        lookupFlexible,
        searchNames,
        getAllByPesticide,
        getAllByCrop,

        // 농약명 매핑
        engToKor,
        resolvePesticideName,

        // 작물명 파싱/별명
        parseCropName,
        resolveCropAlias,

        // 판정
        judge,

        // 상태 확인
        isReady: () => isLoaded,
        getRowCount: () => (allRows ? allRows.length : 0),

        // 상수 노출 (테스트/UI용)
        CACHE_TTL_MS,
        SERVICE_ID
    };
})();

// 브라우저 전역 노출
if (typeof window !== 'undefined') {
    window.MrlApi = MrlApi;
}
