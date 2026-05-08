# 토양 시료 접수 대장 (Soil Sample Log)

봉화군 농업기술센터 **토양 분석 전용** 시료 접수 관리 시스템.
Electron 데스크톱 + 웹 듀얼 환경.

## 주요 기능

- 토양 시료 접수/관리 (논, 밭, 과수, 시설)
- 흙토람 검정결과 엑셀/텍스트 가져오기
- 본필지/하위필지 자동 동기화
- localStorage + Firebase Firestore 듀얼 스토리지 (오프라인 우선)
- 라벨 인쇄, 자동 저장, 통계, 엑셀 내보내기
- 다크모드 지원

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 네트워크 설정 파일 생성 (CI 빌드 전 필수)
cp src/shared/network-config.example.js src/shared/network-config.js
# 그 후 src/shared/network-config.js의 ALLOWED_GATEWAY, VWORLD_API_KEY를 실제 값으로 수정

# 개발 모드 (Electron + Vite)
npm run dev:electron

# Electron만 실행
npm start

# 웹 개발 서버 (localhost:3000)
npm run dev

# 빌드 (docs/ 산출)
npm run build

# 설치 파일 생성 (현재 OS)
npm run make
```

## Firebase 설정

처음 실행 시 Firebase 동기화는 비활성화됩니다.

1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성
2. 웹 앱 추가 → 설정 정보 복사
3. 앱 실행 → **설정** 페이지 → Firebase 설정 입력 → 저장
4. 또는 `firebase-auth.json` 파일을 직접 편집

> 메인 프로젝트(`sample-log-electron`)와 **별도의 Firebase 프로젝트**를 사용해야 데이터가 격리됩니다.

## 릴리스

```bash
# 태그 푸시 시 GitHub Actions가 Windows 설치 파일 자동 생성
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions Secrets 필요:
- `ALLOWED_GATEWAY`
- `VWORLD_API_KEY`

## 라이선스

MIT

## 메인 프로젝트와의 관계

본 프로젝트는 [`sample-log-electron`](https://github.com/bluesky78060/sample-log-electron) (5종 시료 통합본)에서 **토양 부분만 분리**한 독립 프로젝트입니다.
