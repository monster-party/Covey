import { startCoveyFromEnvironment } from './server.js';

export async function runCoveyServer(env = process.env) {
  const runtime = await startCoveyFromEnvironment(env);
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await runtime.stop();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return runtime;
}
