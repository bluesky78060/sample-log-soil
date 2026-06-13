# 토양 시료 접수 대장 (Soil Sample Log)

**토양 분석 전용** 시료 접수·관리 시스템. 전국 농업기술센터·분석기관에서 사용할 수 있습니다.
Electron 데스크톱 + 웹 듀얼 환경.

[![최신 버전 받기](https://img.shields.io/badge/⬇️_최신_버전_받기-Windows_설치파일-22c55e?style=for-the-badge)](https://github.com/bluesky78060/sample-log-soil/releases/latest/download/soil-sample-log-setup.exe)
[![최신 릴리스](https://img.shields.io/github/v/release/bluesky78060/sample-log-soil?style=for-the-badge&label=최신%20버전&color=3b82f6)](https://github.com/bluesky78060/sample-log-soil/releases/latest)
[![웹앱 바로가기](https://img.shields.io/badge/🌐_웹앱_바로가기-GitHub_Pages-8b5cf6?style=for-the-badge)](https://bluesky78060.github.io/sample-log-soil/)

## 📥 다운로드 (Windows)

위 **「⬇️ 최신 버전 받기」** 버튼을 누르면 Windows 설치 파일이 바로 다운로드됩니다.

- 이 버튼(아래 링크)은 **항상 최신 버전**을 가리킵니다. 새 버전이 나와도 링크는 그대로이니, 한 번만 공유해두면 됩니다.
  ```
  https://github.com/bluesky78060/sample-log-soil/releases/latest/download/soil-sample-log-setup.exe
  ```
- 설치된 앱은 **자동 업데이트**를 지원하므로, 한 번 설치하면 이후 새 버전이 자동으로 적용됩니다.
- 변경 내역과 이전 버전은 [릴리스 페이지](https://github.com/bluesky78060/sample-log-soil/releases/latest)에서 확인할 수 있습니다.
- 설치 없이 바로 쓰려면 [웹앱](https://bluesky78060.github.io/sample-log-soil/)을 이용하세요.

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
