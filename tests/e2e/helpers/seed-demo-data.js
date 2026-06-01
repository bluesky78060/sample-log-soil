// @ts-check
/**
 * 캡처용 데모 데이터 시더
 *
 * 레코드 필드 출처: src/soil/soil-script.js 신규 등록 모드(1835~1920줄)
 *   최상위: id, receptionNumber, date, name, phoneNumber, address,
 *           addressPostcode, addressRoad, addressDetail,
 *           subCategory, purpose, receptionMethod, note,
 *           groupId, parcelIndex, totalParcels,
 *           lotAddress, area, cropsDisplay,
 *           createdAt, updatedAt, isComplete
 *   parcels[]: id, lotAddress, isMountain, subLots, crops[]{name,area}, category, purpose, note
 */

const YEAR = 2026;
const STORAGE_KEY = 'soilSampleLogs';

/** @type {Array<Object>} */
const DEMO_RECORDS = [
    // --- 레코드 1: 필지 1개, 작물 1개 (일반 농경지) ---
    {
        id: 'demo-record-001',
        receptionNumber: '1',
        date: '2026-03-10',
        name: '홍길동 (가명)',
        phoneNumber: '010-0000-0001',
        address: '(36100) 경상북도 봉화군 봉화읍 가나리 123',
        addressPostcode: '36100',
        addressRoad: '경상북도 봉화군 봉화읍 봉화로 1',
        addressDetail: '가나리 123',
        subCategory: '일반농경지',
        purpose: '작물재배',
        receptionMethod: '방문',
        note: '',
        groupId: 'demo-group-001',
        parcelIndex: 1,
        totalParcels: 1,
        lotAddress: '경상북도 봉화군 봉화읍 가나리 123',
        area: '1500',
        cropsDisplay: '사과',
        createdAt: '2026-03-10T09:00:00.000Z',
        updatedAt: '2026-03-10T09:00:00.000Z',
        isComplete: true,
        parcels: [
            {
                id: 'demo-parcel-001-1',
                lotAddress: '경상북도 봉화군 봉화읍 가나리 123',
                isMountain: false,
                subLots: [],
                crops: [{ name: '사과', area: '1500' }],
                category: '일반농경지',
                purpose: '작물재배',
                note: ''
            }
        ]
    },

    // --- 레코드 2: 필지 1개, 작물 1개 (성토) ---
    {
        id: 'demo-record-002',
        receptionNumber: '2',
        date: '2026-03-15',
        name: '김농부 (가명)',
        phoneNumber: '010-0000-0002',
        address: '(36200) 경상북도 봉화군 법전면 나다리 456',
        addressPostcode: '36200',
        addressRoad: '경상북도 봉화군 법전면 법전로 2',
        addressDetail: '나다리 456',
        subCategory: '성토',
        purpose: '토양개량',
        receptionMethod: '우편',
        note: '토양 개량 목적 성토 확인 요청',
        groupId: 'demo-group-002',
        parcelIndex: 1,
        totalParcels: 1,
        lotAddress: '경상북도 봉화군 법전면 나다리 456',
        area: '800',
        cropsDisplay: '고추',
        createdAt: '2026-03-15T10:30:00.000Z',
        updatedAt: '2026-03-15T10:30:00.000Z',
        isComplete: false,
        parcels: [
            {
                id: 'demo-parcel-002-1',
                lotAddress: '경상북도 봉화군 법전면 나다리 456',
                isMountain: false,
                subLots: [],
                crops: [{ name: '고추', area: '800' }],
                category: '성토',
                purpose: '토양개량',
                note: ''
            }
        ]
    },

    // --- 레코드 3: 필지 2개 (그룹), 필지별 작물 1개씩 ---
    // 3-1: 첫 번째 필지
    {
        id: 'demo-record-003a',
        receptionNumber: '3',
        date: '2026-04-02',
        name: '이영농 (가명)',
        phoneNumber: '010-0000-0003',
        address: '(36300) 경상북도 봉화군 재산면 다라리 789',
        addressPostcode: '36300',
        addressRoad: '경상북도 봉화군 재산면 재산로 3',
        addressDetail: '다라리 789',
        subCategory: '일반농경지',
        purpose: '작물재배',
        receptionMethod: '방문',
        note: '',
        groupId: 'demo-group-003',
        parcelIndex: 1,
        totalParcels: 2,
        lotAddress: '경상북도 봉화군 재산면 다라리 789',
        area: '2000',
        cropsDisplay: '배추',
        createdAt: '2026-04-02T11:00:00.000Z',
        updatedAt: '2026-04-02T11:00:00.000Z',
        isComplete: true,
        parcels: [
            {
                id: 'demo-parcel-003a-1',
                lotAddress: '경상북도 봉화군 재산면 다라리 789',
                isMountain: false,
                subLots: [],
                crops: [{ name: '배추', area: '2000' }],
                category: '일반농경지',
                purpose: '작물재배',
                note: ''
            }
        ]
    },
    // 3-2: 두 번째 필지 (같은 그룹)
    {
        id: 'demo-record-003b',
        receptionNumber: '4',
        date: '2026-04-02',
        name: '이영농 (가명)',
        phoneNumber: '010-0000-0003',
        address: '(36300) 경상북도 봉화군 재산면 다라리 789',
        addressPostcode: '36300',
        addressRoad: '경상북도 봉화군 재산면 재산로 3',
        addressDetail: '다라리 789',
        subCategory: '일반농경지',
        purpose: '작물재배',
        receptionMethod: '방문',
        note: '',
        groupId: 'demo-group-003',
        parcelIndex: 2,
        totalParcels: 2,
        lotAddress: '경상북도 봉화군 재산면 다라리 790',
        area: '1200',
        cropsDisplay: '마늘',
        createdAt: '2026-04-02T11:00:00.000Z',
        updatedAt: '2026-04-02T11:00:00.000Z',
        isComplete: true,
        parcels: [
            {
                id: 'demo-parcel-003b-1',
                lotAddress: '경상북도 봉화군 재산면 다라리 790',
                isMountain: false,
                subLots: [],
                crops: [{ name: '마늘', area: '1200' }],
                category: '일반농경지',
                purpose: '작물재배',
                note: ''
            }
        ]
    }
];

/**
 * 토양 시료 데모 데이터를 localStorage에 주입한다.
 * page.goto() 호출 전에 실행해야 한다.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [year]
 * @returns {Promise<void>}
 */
async function seedSoilDemoData(page, year = YEAR) {
    await page.addInitScript(
        ({ key, yr, records }) => {
            try {
                localStorage.setItem(`${key}_${yr}`, JSON.stringify(records));
            } catch (e) {
                console.warn('seedSoilDemoData 실패:', e);
            }
        },
        { key: STORAGE_KEY, yr: year, records: DEMO_RECORDS }
    );
}

module.exports = { seedSoilDemoData, DEMO_RECORDS, YEAR, STORAGE_KEY };
