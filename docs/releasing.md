# Releasing the npm packages

`@zmnatz/usa-club-rugby-data`, `@zmnatz/usa-club-rugby-components` and `@zmnatz/usa-club-rugby-html` are released together, at one version. Publishing a GitHub release tagged `v<version>` runs `.github/workflows/publish.yml`, which stages all three at that version after `bun run test` and `bun run verify` pass.

The tag is the only record of the version: no `package.json` in the repo has a `version`. Between packages, each component package's peer dependency on the data package is `workspace:*`. Just before publishing, the job sets each package's `version` from the tag, and each component package's `@zmnatz/usa-club-rugby-data` peer to that same version. It fails before publishing if the tag isn't a version such as `v1.2.3` (a pre-release such as `v1.2.3-beta.1` is allowed).

The latest version is the newest tag: `git tag --list 'v*' --sort=-v:refname | head -1`. Older tags named for one package (`usa-club-rugby-data-v0.4.1`, `usa-club-rugby-components-v0.4.1`) are from when the packages were versioned separately.

## Cutting a release

1. Pick the next version: a new minor version (a new major from 1.0) if any package has a breaking change since the last release, otherwise a patch. It must be above every package's version on npm.
2. Publish a GitHub release from `main` with the tag `v<version>`.
3. The job stages each package. Approve them with 2FA on npmjs.com (Staged Packages), or with `npm stage approve <stage-id>`, and they go public. Approve the data package first, as the others need it.

## One-time npm setup for a package

npm has to trust this repository before the workflow can publish a package. The data and component packages are set up; a new package needs this before the next release:

1. Sign in to npmjs.com with an account that can publish under the `@zmnatz` scope.
2. If the package doesn't exist yet, npm can't trust a publisher for it, so publish a throwaway version by hand. Run `bun run lib`, then, in the package's directory under `packages/`:
   ```sh
   npm pkg set version=0.0.0-test.0
   npm pkg set 'peerDependencies.@zmnatz/usa-club-rugby-data=^<released data version>'
   npm publish --tag test
   git checkout package.json
   ```
   Setting the peer matters: `npm publish` ships `workspace:*` as it is. Don't commit either change or push a tag for it, and don't unpublish it afterwards: unpublishing a package's only version deletes the package and its trusted publisher. Deprecate it instead: `npm deprecate <package>@0.0.0-test.0 "Test publish"`.
3. Open the package's Settings, then Trusted Publisher, and choose GitHub Actions (not GitLab).
4. Enter this repository and the workflow file `publish.yml`, leave the environment blank, and leave `npm publish` unchecked, so the job can only stage a version for approval.
5. Add the package to the loop in `publish.yml`, after the data package.
