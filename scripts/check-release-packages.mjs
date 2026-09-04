import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageSpecs = [
  ['@witqq/spreadsheet', 'packages/core'],
  ['@witqq/spreadsheet-plugins', 'packages/plugins'],
  ['@witqq/spreadsheet-react', 'packages/react'],
  ['@witqq/spreadsheet-vue', 'packages/vue'],
  ['@witqq/spreadsheet-angular', 'packages/angular'],
  ['@witqq/spreadsheet-widget', 'packages/widget'],
];
const sourceRevision = git(['rev-parse', 'HEAD']);
const evidenceRoot = path.join(root, 'test-results', 'release');
fs.mkdirSync(evidenceRoot, { recursive: true });
const candidateRoot = fs.mkdtempSync(path.join(evidenceRoot, 'candidate-'));
const manifests = packageSpecs.map(([expectedName, workspace]) => {
  const manifest = readJson(path.join(root, workspace, 'package.json'));
  assert.equal(manifest.name, expectedName, `${workspace} package name`);
  return { expectedName, workspace, manifest };
});
const versions = new Set(manifests.map(item => item.manifest.version));
assert.equal(versions.size, 1, 'all public packages must use one version');
const [version] = versions;
assert.match(version, /^\d+\.\d+\.\d+$/u);

const candidates = [];
for (const { expectedName, workspace, manifest } of manifests) {
  assert.equal(manifest.engines?.node, '>=24.20.0', `${expectedName} Node contract`);
  assert.equal(manifest.license, 'BUSL-1.1', `${expectedName} license`);
  assert.equal(manifest.publishConfig?.access, 'public', `${expectedName} public access`);
  assert.equal(manifest.repository?.url, 'https://github.com/witqq/spreadsheet.git');
  assert.equal(manifest.repository?.directory, workspace);
  if (expectedName !== '@witqq/spreadsheet') {
    assert.equal(manifest.dependencies?.['@witqq/spreadsheet'], `^${version}`, `${expectedName} core dependency`);
  }

  const output = JSON.parse(runNpm([
    'pack', `./${workspace}`, '--json', '--ignore-scripts', '--pack-destination', candidateRoot,
  ], { cwd: root, encoding: 'utf8' }));
  const records = Array.isArray(output) ? output : Object.values(output);
  assert.equal(records.length, 1, `${expectedName} creates one tarball`);
  const [record] = records;
  const expectedAsset = `${expectedName.slice(1).replace('/', '-')}-${version}.tgz`;
  assert.equal(record.filename, expectedAsset, `${expectedName} asset name`);
  const tarballPath = path.join(candidateRoot, expectedAsset);
  const bytes = fs.readFileSync(tarballPath);
  const sha256 = hash(bytes);
  const tarFiles = execFileSync('tar', ['-tf', tarballPath], { encoding: 'utf8' })
    .trim().split(/\r?\n/u).filter(entry => entry && !entry.endsWith('/')).sort();
  const npmFiles = record.files.map(file => `package/${file.path}`).sort();
  assert.deepEqual(tarFiles, npmFiles, `${expectedName} npm/tar inventory`);
  for (const required of ['package/LICENSE', 'package/README.md', 'package/package.json']) {
    assert.ok(tarFiles.includes(required), `${expectedName} includes ${required}`);
  }
  for (const entry of tarFiles) {
    assert.ok(
      ['package/LICENSE', 'package/README.md', 'package/package.json'].includes(entry) ||
        entry.startsWith('package/dist/') || entry.startsWith('package/docs/'),
      `${expectedName} contains only public allowlisted files; found ${entry}`,
    );
  }

  const extracted = path.join(candidateRoot, `extracted-${workspace.split('/').at(-1)}`);
  fs.mkdirSync(extracted);
  execFileSync('tar', ['-xf', tarballPath, '-C', extracted]);
  for (const entry of tarFiles) {
    const file = path.join(extracted, ...entry.split('/'));
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), `${entry} is a regular file`);
    assertPublishSafe(fs.readFileSync(file), entry);
  }
  const packed = readJson(path.join(extracted, 'package', 'package.json'));
  assert.equal(packed.name, expectedName);
  assert.equal(packed.version, version);
  assert.equal(packed.repository?.directory, workspace);
  assert.equal(packed.engines?.node, '>=24.20.0');
  assertExports(extracted, packed);
  for (const range of Object.values({ ...packed.dependencies, ...packed.devDependencies })) {
    assert.ok(!/^(?:file|link|workspace):/u.test(String(range)), `${expectedName} has no local dependency`);
  }

  candidates.push({
    name: expectedName,
    workspace,
    asset: expectedAsset,
    sha256,
    size: bytes.length,
    repositoryDirectory: workspace,
  });
}

const releaseManifest = {
  schemaVersion: 1,
  tag: `v${version}`,
  version,
  sourceRevision,
  publishOrder: packageSpecs.map(([name]) => name),
  packages: candidates,
};
const manifestFilename = `spreadsheet-release-${version}.json`;
const manifestPath = path.join(candidateRoot, manifestFilename);
fs.writeFileSync(manifestPath, `${JSON.stringify(releaseManifest, null, 2)}\n`);
const manifestSha256 = hash(fs.readFileSync(manifestPath));

const consumer = path.join(candidateRoot, 'consumer');
fs.mkdirSync(consumer);
const peerNames = [
  'react', 'react-dom', 'vue', '@angular/core', '@angular/common', 'rxjs', 'zone.js',
];
const dependencies = Object.fromEntries(candidates.map(item => [item.name, `file:${path.join(candidateRoot, item.asset)}`]));
for (const peer of peerNames) dependencies[peer] = installedVersion(peer);
fs.writeFileSync(path.join(consumer, 'package.json'), `${JSON.stringify({
  name: 'spreadsheet-release-consumer', private: true, type: 'module', dependencies,
}, null, 2)}\n`);
runNpm(['install', '--package-lock=false', '--ignore-scripts', '--no-audit', '--no-fund', '--loglevel=error'], {
  cwd: consumer, stdio: 'pipe', timeout: 240_000,
});
const specifiers = packageSpecs.map(([name]) => name);
fs.writeFileSync(path.join(consumer, 'esm.mjs'),
  `const loaded = await Promise.all(${JSON.stringify(specifiers)}.map(name => import(name)));\nconsole.log(JSON.stringify({esm: loaded.length}));\n`);
const esm = execFileSync(process.execPath, ['esm.mjs'], { cwd: consumer, encoding: 'utf8' }).trim();
assert.equal(esm, JSON.stringify({ esm: 6 }), 'all ESM packages import together');

const commonjsSpecifiers = manifests
  .filter(item => typeof item.manifest.exports?.['.']?.require === 'string')
  .map(item => item.expectedName);
fs.writeFileSync(path.join(consumer, 'cjs.cjs'),
  `const loaded = ${JSON.stringify(commonjsSpecifiers)}.map(name => require(name));\nconsole.log(JSON.stringify({commonjs: loaded.length}));\n`);
const commonjs = execFileSync(process.execPath, ['cjs.cjs'], { cwd: consumer, encoding: 'utf8' }).trim();
assert.equal(commonjs, JSON.stringify({ commonjs: commonjsSpecifiers.length }), 'all advertised CommonJS packages load together');

const typeImports = specifiers.map((name, index) =>
  `import type * as Package${index} from '${name}'; type Use${index} = typeof Package${index};`,
).join('\n');
fs.writeFileSync(path.join(consumer, 'contract.ts'), `${typeImports}\nexport type AllPackages = [${specifiers.map((_, index) => `Use${index}`).join(', ')}];\n`);
fs.writeFileSync(path.join(consumer, 'tsconfig.json'), `${JSON.stringify({ compilerOptions: {
  strict: true, noEmit: true, module: 'NodeNext', moduleResolution: 'NodeNext',
  target: 'ES2022', jsx: 'react-jsx', skipLibCheck: true,
}, include: ['contract.ts'] }, null, 2)}\n`);
execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '--project', 'tsconfig.json'], {
  cwd: consumer, stdio: 'pipe', timeout: 60_000,
});

const sourceDirty = git(['status', '--porcelain']) !== '';
const evidence = {
  version,
  sourceRevision,
  sourceDirty,
  releaseManifest: { path: manifestPath, filename: manifestFilename, sha256: manifestSha256 },
  packages: candidates,
  consumer: { esm: 6, commonjs: commonjsSpecifiers.length, types: 6, peers: Object.fromEntries(peerNames.map(name => [name, dependencies[name]])) },
};
const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`;
fs.writeFileSync(path.join(candidateRoot, 'candidate-evidence.json'), evidenceJson);
fs.writeFileSync(path.join(evidenceRoot, 'candidate-evidence.json'), evidenceJson);
console.log(JSON.stringify({ version, manifest: manifestPath, manifestSha256, packages: candidates, consumer: evidence.consumer }));

function assertExports(extracted, manifest) {
  const contract = manifest.exports?.['.'];
  assert.ok(contract && typeof contract === 'object', `${manifest.name} root export`);
  for (const key of ['types', 'import', 'require']) {
    if (contract[key] === undefined) continue;
    assert.match(contract[key], /^\.\/dist\//u);
    const file = path.join(extracted, 'package', contract[key]);
    assert.ok(fs.statSync(file).isFile(), `${manifest.name} ${key} export exists`);
  }
}

function assertPublishSafe(bytes, file) {
  if (bytes.includes(0)) return;
  const text = bytes.toString('utf8');
  for (const pattern of [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
    /(?:^|\n)\s*(?:NPM_TOKEN|NODE_AUTH_TOKEN|_authToken)\s*[:=]/u,
    /\b(?:ghp|github_pat|npm)_[A-Za-z0-9_-]{20,}\b/u,
    /\/(?:Users|home)\/[A-Za-z0-9._-]+\//u,
    /(?:^|\/)moira-ws(?:\/|$)/u,
    /(?:^|\/)agent_temp_files_local(?:\/|$)/u,
  ]) assert.doesNotMatch(text, pattern, `${file} contains private or credential-shaped data`);
}

function installedVersion(name) {
  for (const base of [root, ...packageSpecs.map(([, workspace]) => path.join(root, workspace))]) {
    const manifestPath = path.join(base, 'node_modules', ...name.split('/'), 'package.json');
    if (fs.existsSync(manifestPath)) return readJson(manifestPath).version;
  }
  throw new Error(`Cannot find installed peer ${name}`);
}

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function runNpm(args, options) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, 'run package checks through npm');
  return execFileSync(process.execPath, [npmCli, ...args], { ...options, maxBuffer: 20 * 1024 * 1024 });
}
