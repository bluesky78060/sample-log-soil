const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

// asar 에는 실행에 필요한 최상위만 싣는다 (SLS-1-290). 차단 목록이 아니라 허용 목록이라
// 저장소에 새 도구 폴더가 생겨도 저절로 빠진다. src/ 는 통째로 둔다 — 새 메인 프로세스 파일이
// 빠지면 설치본이 뜨지 않고 자동 업데이트로도 복구되지 않는다.
// 함수를 주면 packager 의 기본 제외가 사라지므로 락파일·.git·.bin·네이티브 빌드 잔재를 여기서 되살린다.
const ASAR_KEEP = new Set(['package.json', 'src', 'docs', 'node_modules']);
function asarIgnore(p) {
  if (!p) return false; // 앱 루트 자신
  if (!ASAR_KEEP.has(p.split('/')[1])) return true;
  return /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|node_gyp_bins|\.git)($|\/)|node_modules\/\.bin($|\/)|\.o(bj)?$/.test(p);
}

module.exports = {
  packagerConfig: {
    asar: true,
    ignore: asarIgnore,
    name: 'soil-sample-log',
    executableName: 'soil-sample-log',
    appBundleId: 'com.soilsamplelog.app',
    // SLS-1-21: .env를 packaged 앱의 resources/ 디렉토리에 동봉 (process.resourcesPath/.env)
    // GitHub Actions가 빌드 직전 secrets → .env 생성
    // SLS-1-151: 게시판 전용 Firebase 설정(feedback-auth.json)도 동봉(렌더러 번들 미포함, Electron 런타임 로드)
    extraResource: ['./app-update.yml', './.env', './feedback-auth.json'],
    icon: path.resolve(__dirname, 'assets', 'icon'),
  },
  rebuildConfig: {},
  hooks: {
    postPackage: async (config, packageResult) => {
      const fs = require('fs');
      const iconPath = path.resolve(__dirname, 'assets', 'icon.icns');
      for (const outputPath of packageResult.outputPaths) {
        const resourcesPath = path.join(outputPath, 'soil-sample-log.app', 'Contents', 'Resources', 'electron.icns');
        if (fs.existsSync(resourcesPath)) {
          fs.copyFileSync(iconPath, resourcesPath);
          console.log('Icon copied to:', resourcesPath);
        }
      }
    }
  },
  // SLS-1-126: GitHub Release 자동 배포 (npm run publish) — 메인 sample-log-electron과 동일 구성
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'bluesky78060',
          name: 'sample-log-soil'
        },
        prerelease: false
      }
    }
  ],
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'soil-sample-log',
        setupExe: 'soil-sample-log-setup.exe',
        setupIcon: path.resolve(__dirname, 'assets', 'icon.ico'),
        title: '토양 시료 접수 대장',
        shortcutName: '토양 시료 접수 대장',
        authors: '토양 시료 접수 대장',
        description: '토양 시료 접수 관리 프로그램'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
