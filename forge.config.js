const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'soil-sample-log',
    executableName: 'soil-sample-log',
    appBundleId: 'com.soilsamplelog.app',
    // SLS-1-21: .env를 packaged 앱의 resources/ 디렉토리에 동봉 (process.resourcesPath/.env)
    // GitHub Actions가 빌드 직전 secrets → .env 생성
    extraResource: ['./app-update.yml', './.env'],
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
        authors: '봉화군 농업기술센터',
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
