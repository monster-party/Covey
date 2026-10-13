import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('Covey Server.app must be built on macOS.');

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDirectory, 'package.json'), 'utf8'));
const developerDirectory = process.env.DEVELOPER_DIR || '/Applications/Xcode.app/Contents/Developer';
const cacheDirectory = path.join(rootDirectory, 'macos', '.build', 'cache');
const artifactDirectory = path.join(rootDirectory, 'artifacts', `covey-server-${process.platform}-${process.arch}`);
const appDirectory = path.join(rootDirectory, 'artifacts', 'Covey Server.app');
const contentsDirectory = path.join(appDirectory, 'Contents');
const macOSDirectory = path.join(contentsDirectory, 'MacOS');
const resourcesDirectory = path.join(contentsDirectory, 'Resources');
const iconsetDirectory = path.join(rootDirectory, 'macos', '.build', 'CoveyServer.iconset');
const appIconSource = path.join(rootDirectory, 'macos', '.build', 'CoveyServer-app-icon.png');

function run(command, argumentsList) {
  const result = spawnSync(command, argumentsList, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed with status ${result.status}.`);
}

const swift = spawnSync('swift', [
  'build',
  '--package-path', path.join(rootDirectory, 'macos'),
  '--scratch-path', path.join(rootDirectory, 'macos', '.build'),
  '-c', 'release',
], {
  cwd: rootDirectory,
  env: {
    ...process.env,
    DEVELOPER_DIR: developerDirectory,
    CLANG_MODULE_CACHE_PATH: path.join(cacheDirectory, 'clang'),
    SWIFTPM_MODULECACHE_OVERRIDE: path.join(cacheDirectory, 'clang'),
    XDG_CACHE_HOME: path.join(cacheDirectory, 'swiftpm'),
  },
  stdio: 'inherit',
});
if (swift.status !== 0) throw new Error(`Swift build failed with status ${swift.status}.`);

const hostExecutable = path.join(rootDirectory, 'macos', '.build', 'release', 'CoveyServerHost');
for (const required of [hostExecutable, path.join(artifactDirectory, 'server.cjs')]) {
  if (!fs.existsSync(required)) throw new Error(`Required build output is missing: ${required}`);
}

fs.rmSync(appDirectory, { recursive: true, force: true });
fs.mkdirSync(macOSDirectory, { recursive: true });
fs.mkdirSync(resourcesDirectory, { recursive: true });
fs.copyFileSync(hostExecutable, path.join(macOSDirectory, 'CoveyServer'));
fs.chmodSync(path.join(macOSDirectory, 'CoveyServer'), 0o755);
fs.cpSync(artifactDirectory, path.join(resourcesDirectory, 'Server'), { recursive: true });
run('xcrun', [
  'swift',
  path.join(rootDirectory, 'scripts', 'render-macos-menu-icon.swift'),
  appIconSource,
  path.join(resourcesDirectory, 'CoveyMenuBarTemplate.png'),
]);

fs.rmSync(iconsetDirectory, { recursive: true, force: true });
fs.mkdirSync(iconsetDirectory, { recursive: true });
for (const [filename, size] of [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
]) {
  run('sips', ['-z', String(size), String(size), appIconSource, '--out', path.join(iconsetDirectory, filename)]);
}
run('iconutil', [
  '-c', 'icns',
  iconsetDirectory,
  '-o', path.join(resourcesDirectory, 'CoveyServer.icns'),
]);

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>CoveyServer</string>
  <key>CFBundleIdentifier</key><string>com.covey.server</string>
  <key>CFBundleIconFile</key><string>CoveyServer</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>Covey Server</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${packageJson.version}</string>
  <key>CFBundleVersion</key><string>${packageJson.version}</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`;
fs.writeFileSync(path.join(contentsDirectory, 'Info.plist'), infoPlist);
fs.writeFileSync(path.join(contentsDirectory, 'PkgInfo'), 'APPL????');

const signing = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appDirectory], {
  stdio: 'inherit',
});
if (signing.status !== 0) throw new Error(`Ad-hoc code signing failed with status ${signing.status}.`);

console.log(`Built Covey Server.app at ${appDirectory}`);
