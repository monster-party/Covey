import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('defines a menu-bar macOS host for the bundled server', () => {
  const app = read('macos/Sources/CoveyServerHost/CoveyServerApp.swift');
  const controller = read('macos/Sources/CoveyServerHost/ServerController.swift');
  const build = read('scripts/build-macos-app.js');

  assert.match(app, /MenuBarExtra\("Covey Server"/);
  assert.match(app, /Open Covey/);
  assert.match(app, /Start Server/);
  assert.match(app, /Stop Server/);
  assert.match(controller, /applicationSupportDirectory/);
  assert.match(controller, /api\/health/);
  assert.match(controller, /COVEY_DATA_DIR/);
  assert.match(controller, /process\.terminationHandler/);
  assert.match(build, /Covey Server\.app/);
  assert.match(build, /codesign/);
});
