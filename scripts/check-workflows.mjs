import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDocument } from 'yaml';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkout = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const setupNode = 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020';
const ciSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
const publishSource = fs.readFileSync(path.join(root, '.github', 'workflows', 'publish-npm.yml'), 'utf8');
const ci = parse(ciSource, 'CI');
const publish = parse(publishSource, 'publication');

assert.equal(ci.name, 'CI');
assert.ok(Object.hasOwn(ci.on, 'pull_request'));
assert.ok(Object.hasOwn(ci.on, 'push'));
assert.ok(Object.hasOwn(ci.on, 'workflow_dispatch'));
assert.deepEqual(ci.permissions, { contents: 'read' });
const verify = record(ci.jobs?.verify, 'verify job');
assert.equal(verify['runs-on'], 'ubuntu-24.04');
assertUses(verify, checkout);
assertUses(verify, setupNode);
assertNode24(verify);
for (const command of [
  'npm install --global npm@12.0.2',
  'npm ci --no-audit --no-fund',
  'npm run verify',
]) assertRuns(verify, command);
assertPinned(ci);

assert.equal(publish.name, 'Publish coordinated npm release');
assert.deepEqual(Object.keys(publish.on), ['workflow_dispatch']);
assert.deepEqual(Object.keys(publish.on.workflow_dispatch.inputs).sort(), ['manifest_sha256', 'tag']);
assert.deepEqual(publish.permissions, { contents: 'read', 'id-token': 'write' });
assert.equal(publish.concurrency?.['cancel-in-progress'], false);
const job = record(publish.jobs?.publish, 'publish job');
assert.equal(job['runs-on'], 'ubuntu-24.04');
assertUses(job, setupNode);
assertNode24(job);
const runs = steps(job).map(step => step.run).filter(Boolean).join('\n');
for (const required of [
  'npm install --global npm@12.0.2',
  'git/ref/tags/${tag}',
  'release.assets?.length !== 7',
  'manifest.publishOrder',
  'asset.digest !== `sha256:${item.sha256}`',
  'registry-preflight-${index}.tgz',
  'already contains the accepted bytes; skipping',
  'tarball="${RUNNER_TEMP}/${asset_name}"',
  'npm publish --access public "${tarball}"',
  'registry-final-${index}.tgz',
]) assert.ok(runs.includes(required), `publication must enforce ${required}`);
const preflight = runs.indexOf('registry-preflight-${index}.tgz');
const firstPublish = runs.indexOf('npm publish --access public "${tarball}"');
assert.ok(preflight >= 0 && preflight < firstPublish, 'all existing registry versions are checked before publication');
assert.ok(runs.includes('if existing_url="$(npm view'), 'registry absence must be decided by npm view exit status');
assert.ok(!runs.includes('dist.tarball --json 2>/dev/null || true'), 'registry lookup errors must not become JSON values');
assert.ok(!runs.includes('npm publish --access public "${asset_url}"'), 'npm 12 must not publish a remote URL');
for (const forbidden of ['actions/checkout@', 'NPM_TOKEN', 'NODE_AUTH_TOKEN', 'npm ci', 'npm run build', 'npm test', 'npm pack']) {
  assert.ok(!publishSource.includes(forbidden), `publication must exclude ${forbidden}`);
}
assertPinned(publish);
console.log('GitHub Actions coordinated release contracts are valid.');

function parse(source, label) {
  const document = parseDocument(source);
  assert.equal(document.errors.length, 0, `${label} workflow must be valid YAML`);
  return record(document.toJS(), label);
}

function record(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function steps(job) {
  assert.ok(Array.isArray(job.steps));
  return job.steps.map(step => record(step, 'step'));
}

function assertUses(job, expected) {
  assert.ok(steps(job).some(step => step.uses === expected), `workflow must use ${expected}`);
}

function assertRuns(job, expected) {
  assert.ok(steps(job).some(step => step.run === expected), `workflow must run ${expected}`);
}

function assertNode24(job) {
  const setup = steps(job).find(step => step.uses === setupNode);
  assert.equal(setup?.with?.['node-version'], '24.20.0');
  assert.equal(setup?.with?.['package-manager-cache'], false);
}

function assertPinned(workflow) {
  for (const job of Object.values(record(workflow.jobs, 'jobs'))) {
    for (const step of steps(record(job, 'job'))) {
      if (step.uses) assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/u);
    }
  }
}
