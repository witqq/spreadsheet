# Coordinated release process

The six public packages are one release unit: `@witqq/spreadsheet`, `@witqq/spreadsheet-plugins`, `@witqq/spreadsheet-react`, `@witqq/spreadsheet-vue`, `@witqq/spreadsheet-angular`, and `@witqq/spreadsheet-widget`. Every release uses one version, one annotated Git tag, one GitHub Release, six npm tarballs and one release manifest. npm receives the accepted tarball bytes without rebuilding them.

## Runtime and trusted publishers

Use Node.js 24.20.0 and npm 12.0.2. `.nvmrc`, `.node-version`, root/workspace `engines`, Docker builds and GitHub Actions use the same releases.

Configure an npm GitHub Actions trusted publisher for each of the six packages with organization `witqq`, repository `spreadsheet`, workflow filename `publish-npm.yml`, no environment, and publish permission. Do not add `NPM_TOKEN`: the GitHub-hosted job authenticates through OpenID Connect (OIDC) with `id-token: write`.

## Prepare the complete candidate set

Set the same version in all six public manifests and the matching `@witqq/spreadsheet` dependency range in the five dependent packages. Update the lockfile and changelog, then run from a clean feature branch:

```sh
npm ci --no-audit --no-fund
npm run verify
git status --short
```

The gate regenerates npm documentation, builds every buildable public and private workspace, typechecks every typed workspace, runs all unit tests and lint, requires a zero-vulnerability `npm audit`, validates both workflows, and creates six exact tarballs. It verifies inventories, public metadata, exports, private paths and credential-shaped content, writes one `spreadsheet-release-VERSION.json`, then installs all six tarballs and framework peers together in an isolated consumer and checks ESM, CommonJS and TypeScript resolution.

The accepted record is `test-results/release/candidate-evidence.json`. Require `sourceDirty` to be `false`; retain its seven asset paths, six package digests and release-manifest digest. Do not change repository bytes after accepting them. A merge commit may reuse the candidate set only when its Git tree is byte-identical to the reviewed head.

## Create one GitHub Release

After CI passes and the reviewed branch is merged into public `master`, create an annotated `vVERSION` tag on that merge commit. Create one non-draft, non-prerelease GitHub Release containing exactly:

- `spreadsheet-release-VERSION.json`;
- the six tarballs named in that manifest.

End the notes with `[Made with Moira](https://moira-mcp.com/)`. Public tags, versions and assets are immutable; never replace or move them.

## Publish, retry and verify

Dispatch `.github/workflows/publish-npm.yml` from `master` with the tag and accepted manifest SHA-256. Before publishing anything, the job validates the annotated tag and `master` ancestry, all seven GitHub assets, every digest and all six package identities. It also checks every already-existing npm version against its accepted digest.

Publication order is core first, followed by plugins and the four wrappers. A retry is safe after a partial registry or network failure: an already-published version is skipped only when its registry tarball exactly matches the accepted digest; a mismatch fails before any new package is published. Missing packages continue in dependency order. The final stage downloads all six registry tarballs and compares their SHA-256 values again.

The release is complete only when all six npm `latest` tags equal the coordinated version, npm records provenance for each package, registry bytes equal the GitHub assets, and a new empty consumer installs all six packages together and passes their ESM, advertised CommonJS and TypeScript contracts.
