import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolveRuntimeOptions } from '../runtime-config.js';
import { createCoveyRuntime, startCoveyFromEnvironment } from '../server.js';

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const silentLogger = { info() {}, error() {} };

test('normalizes environment configuration for the shared runtime', () => {
  const options = resolveRuntimeOptions({
    rootDirectory,
    env: {
      ICLOUD_EMAIL: ' family@example.com ',
      ICLOUD_APP_PASSWORD: ' app-password ',
      COVEY_DATA_DIR: './household-data',
      COVEY_ASSETS_DIR: './public-build',
      COVEY_HOST: '127.0.0.1',
      PORT: '4321',
      CALENDAR_NAME: 'Family',
    },
  });

  assert.deepEqual(options.credentials, {
    username: 'family@example.com',
    password: 'app-password',
  });
  assert.equal(options.dataDirectory, path.resolve('./household-data'));
  assert.equal(options.assetsDirectory, path.resolve('./public-build'));
  assert.equal(options.host, '127.0.0.1');
  assert.equal(options.port, 4321);
  assert.equal(options.legacyCalendars.CALENDAR_NAME, 'Family');
});

test('starts and stops Covey from explicit runtime dependencies', async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-runtime-'));
  const runtime = createCoveyRuntime({
    credentials: { username: 'family@example.com', password: 'app-password' },
    dataDirectory,
    assetsDirectory: rootDirectory,
    legacyCalendars: { CALENDAR_NAME: 'Family' },
    version: 'test-version',
    logger: silentLogger,
  });

  try {
    const address = await runtime.start({ host: '127.0.0.1', port: 0 });
    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const health = await response.json();

    assert.equal(response.status, 200);
    assert.equal(health.status, 'ok');
    assert.equal(health.service, 'covey-server');
    assert.equal(health.version, 'test-version');
    assert.match(health.startedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(typeof health.uptimeSeconds, 'number');

    const statusResponse = await fetch(`http://127.0.0.1:${address.port}/api/status`);
    const status = await statusResponse.json();
    assert.equal(status.status, 'ready');
    assert.equal(status.iCloudConnected, false);
    assert.equal(status.calendars, 1);
    assert.equal(status.tasks, 0);

    const createResponse = await fetch(`http://127.0.0.1:${address.port}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Put bins out', dueDate: '2026-10-12' }),
    });
    const created = (await createResponse.json()).task;
    assert.equal(createResponse.status, 201);
    assert.equal(created.revision, 1);

    const completeResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/tasks/${created.id}/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revision: created.revision }),
      },
    );
    const completed = (await completeResponse.json()).task;
    assert.equal(completed.status, 'completed');

    const staleResponse = await fetch(`http://127.0.0.1:${address.port}/api/tasks/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: created.revision, title: 'Stale change' }),
    });
    assert.equal(staleResponse.status, 409);
    assert.equal((await staleResponse.json()).current.revision, completed.revision);
  } finally {
    await runtime.stop();
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});

test('rejects an asset directory without the Covey web client', () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-data-'));
  const assetsDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-assets-'));
  try {
    assert.throws(
      () => createCoveyRuntime({
        credentials: { username: 'family@example.com', password: 'app-password' },
        dataDirectory,
        assetsDirectory,
        logger: silentLogger,
      }),
      /web assets are missing index\.html/,
    );
  } finally {
    fs.rmSync(dataDirectory, { recursive: true, force: true });
    fs.rmSync(assetsDirectory, { recursive: true, force: true });
  }
});

test('preserves the environment-based npm startup path', async () => {
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-env-runtime-'));
  let runtime;
  try {
    runtime = await startCoveyFromEnvironment({
      ICLOUD_EMAIL: 'family@example.com',
      ICLOUD_APP_PASSWORD: 'app-password',
      CALENDAR_NAME: 'Family',
      COVEY_DATA_DIR: dataDirectory,
      COVEY_ASSETS_DIR: rootDirectory,
      COVEY_HOST: '127.0.0.1',
      PORT: '0',
    }, { logger: silentLogger });

    const response = await fetch(`http://127.0.0.1:${runtime.address.port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).service, 'covey-server');
  } finally {
    await runtime?.stop();
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  }
});
