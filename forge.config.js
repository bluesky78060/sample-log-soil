const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'soil-sample-log',
    executableName: 'soil-sample-log',
    appBundleId: 'com.soilsamplelog.app',
    extraResource: ['./app-update.yml'],
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
  publishers: [],
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
