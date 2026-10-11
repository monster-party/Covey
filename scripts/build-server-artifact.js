import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(
  fs.readFileSync(path.join(rootDirectory, 'package.json'), 'utf8'),
);
const artifactName = `covey-server-${process.platform}-${process.arch}`;
const artifactDirectory = path.join(rootDirectory, 'artifacts', artifactName);
const publicDirectory = path.join(artifactDirectory, 'public');
const binDirectory = path.join(artifactDirectory, 'bin');
const nodeTarget = `node${process.versions.node.split('.')[0]}`;

const requiredPath = (target, description) => {
  if (!fs.existsSync(target)) {
    throw new Error(`${description} is missing at ${target}.`);
  }
};

requiredPath(path.join(rootDirectory, 'dist', 'index.html'), 'Production web build');
requiredPath(process.execPath, 'Node runtime');

fs.rmSync(artifactDirectory, { recursive: true, force: true });
fs.mkdirSync(publicDirectory, { recursive: true });
fs.mkdirSync(binDirectory, { recursive: true });

await build({
  entryPoints: [path.join(rootDirectory, 'server-artifact-entry.js')],
  outfile: path.join(artifactDirectory, 'server.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: nodeTarget,
  define: { 'import.meta.url': 'undefined' },
  sourcemap: false,
  legalComments: 'none',
});

fs.cpSync(path.join(rootDirectory, 'dist'), publicDirectory, { recursive: true });
const nodeExecutable = path.join(binDirectory, 'node');
fs.copyFileSync(process.execPath, nodeExecutable);
fs.chmodSync(nodeExecutable, 0o755);

const launcherPath = path.join(artifactDirectory, 'covey-server');
fs.writeFileSync(
  launcherPath,
  '#!/bin/sh\nDIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"\nexec "$DIR/bin/node" "$DIR/server.cjs" "$@"\n',
  { mode: 0o755 },
);

fs.writeFileSync(
  path.join(artifactDirectory, 'manifest.json'),
  `${JSON.stringify({
    name: 'Covey Server',
    version: packageJson.version,
    platform: process.platform,
    architecture: process.arch,
    node: process.versions.node,
    executable: 'covey-server',
  }, null, 2)}\n`,
);

console.log(`Built ${artifactName} at ${artifactDirectory}`);
