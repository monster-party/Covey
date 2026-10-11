import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '.env');
const credentialCheck = `const email = (process.env.ICLOUD_EMAIL || '').trim();
const password = (process.env.ICLOUD_APP_PASSWORD || '').trim();
const validEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) && !/@example\\.(?:com|net|org)$/i.test(email);
const placeholder = /^(?:your|placeholder|change[_ -]?me|xxxx)/i;
process.exit(validEmail && !placeholder.test(email) && password && !placeholder.test(password) ? 0 : 2);`;

function credentialsConfigured() {
  if (!fs.existsSync(envPath)) {
    const email = (process.env.ICLOUD_EMAIL || '').trim();
    const password = (process.env.ICLOUD_APP_PASSWORD || '').trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/@example\.(?:com|net|org)$/i.test(email);
    const placeholder = /^(?:your|placeholder|change[_ -]?me|xxxx)/i;
    return validEmail && !placeholder.test(email) && password.length > 0 && !placeholder.test(password);
  }

  const probe = spawnSync(
    process.execPath,
    [`--env-file=${envPath}`, '-e', credentialCheck],
    { cwd: here, encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] },
  );
  if (probe.error) throw probe.error;
  if (probe.status === 0) return true;
  if (probe.status === 2) return false;
  throw new Error('Could not load .env; check its syntax and try again.');
}

function runNode(args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: here,
      env,
      stdio: 'inherit',
    });
    const forwardSignal = (signal) => child.kill(signal);
    process.once('SIGINT', forwardSignal);
    process.once('SIGTERM', forwardSignal);
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      process.removeListener('SIGINT', forwardSignal);
      process.removeListener('SIGTERM', forwardSignal);
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  let configured;
  try {
    configured = credentialsConfigured();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  let ranSetup = false;
  if (!configured) {
    console.log('iCloud credentials are missing. Starting Covey setup…\n');
    const setupCode = await runNode(['setup.js']);
    if (setupCode !== 0) {
      process.exitCode = setupCode || 1;
      return;
    }
    ranSetup = true;
  }

  const env = { ...process.env };
  if (ranSetup) {
    delete env.ICLOUD_EMAIL;
    delete env.ICLOUD_APP_PASSWORD;
  }
  const args = fs.existsSync(envPath) ? [`--env-file=${envPath}`] : [];
  args.push('server-entry.js');
  process.exitCode = await runNode(args, env);
}

main().catch((error) => {
  console.error(`Unable to start Covey: ${error.message}`);
  process.exitCode = 1;
});
