import { runCoveyServer } from './server-cli.js';

runCoveyServer().catch((error) => {
  console.error(`Unable to start Covey: ${error.message}`);
  process.exitCode = 1;
});
