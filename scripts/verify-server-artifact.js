import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const artifactDirectory = path.join(
  rootDirectory,
  'artifacts',
  `covey-server-${process.platform}-${process.arch}`,
);
const nodeExecutable = path.join(artifactDirectory, 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
const serverBundle = path.join(artifactDirectory, 'server.cjs');
const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'covey-artifact-check-'));

for (const required of [nodeExecutable, serverBundle, path.join(artifactDirectory, 'public', 'index.html')]) {
  if (!fs.existsSync(required)) throw new Error(`Build the server artifact first; missing ${required}.`);
}

const child = spawn(nodeExecutable, [serverBundle], {
  cwd: artifactDirectory,
  env: {
    ...process.env,
    ICLOUD_EMAIL: 'artifact-check@example.com',
    ICLOUD_APP_PASSWORD: 'artifact-check-password',
    CALENDAR_NAME: 'Family',
    COVEY_DATA_DIR: dataDirectory,
    COVEY_HOST: '127.0.0.1',
    PORT: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const serverUrl = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for the artifact to start.')), 10_000);
  let output = '';
  const inspect = (chunk) => {
    output += chunk.toString();
    const match = output.match(/Covey is running on (http:\/\/[^\s]+)/);
    if (match) {
      clearTimeout(timeout);
      resolve(match[1]);
    }
  };
  child.stdout.on('data', inspect);
  child.stderr.on('data', inspect);
  child.once('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  child.once('exit', (code) => {
    if (code !== null) {
      clearTimeout(timeout);
      reject(new Error(`Artifact exited before startup with code ${code}: ${output}`));
    }
  });
});

try {
  const healthResponse = await fetch(`${serverUrl}/api/health`);
  const health = await healthResponse.json();
  if (!healthResponse.ok || health.status !== 'ok' || health.service !== 'covey-server') {
    throw new Error(`Artifact health check failed: ${JSON.stringify(health)}`);
  }
  const pageResponse = await fetch(serverUrl);
  const page = await pageResponse.text();
  if (!pageResponse.ok || !page.includes('window.GAGGLE_SERVER = true')) {
    throw new Error('Artifact did not serve the production Covey client.');
  }
  console.log(`Verified Covey Server ${health.version} at ${serverUrl}`);
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  fs.rmSync(dataDirectory, { recursive: true, force: true });
}
