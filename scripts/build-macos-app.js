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

const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>CoveyServer</string>
  <key>CFBundleIdentifier</key><string>com.covey.server</string>
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
