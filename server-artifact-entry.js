import path from 'node:path';

const artifactDirectory = path.dirname(path.resolve(process.argv[1]));
process.env.COVEY_RUNTIME_ROOT = artifactDirectory;
process.env.COVEY_ASSETS_DIR ||= path.join(artifactDirectory, 'public');
process.env.COVEY_DATA_DIR ||= path.join(artifactDirectory, 'data');

async function main() {
  const { runCoveyServer } = await import('./server-cli.js');
  await runCoveyServer();
}

main().catch((error) => {
    console.error(`Unable to start Covey Server: ${error.message}`);
    process.exitCode = 1;
});
