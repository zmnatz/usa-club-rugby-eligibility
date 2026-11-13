# Releasing the npm packages

`@zmnatz/usa-club-rugby-data`, `@zmnatz/usa-club-rugby-components` and `@zmnatz/usa-club-rugby-html` version independently. Publishing a GitHub release runs `.github/workflows/publish.yml`, which publishes only the package the release's tag names, after `bun run test` and `bun run verify` pass.

| Package | Tag |
| --- | --- |
| `@zmnatz/usa-club-rugby-data` | `usa-club-rugby-data-v<version>` |
| `@zmnatz/usa-club-rugby-components` | `usa-club-rugby-components-v<version>` |
| `@zmnatz/usa-club-rugby-html` | `usa-club-rugby-html-v<version>` |

A tag named for a package must match the `version` in its `package.json`, or the job fails before publishing. A tag in any other form publishes the data package, as releases did before there was more than one package.

## Cutting a release

1. Bump `version` in the package's `package.json` and merge it. If a component package needs a new data package feature, raise its `@zmnatz/usa-club-rugby-data` peer range too.
2. Publish a GitHub release with the tag above.
3. The job stages the version. Approve it with 2FA on npmjs.com (Staged Packages), or with `npm stage approve <stage-id>`, and it goes public.

Release the data package first when a component package's peer range needs a version that isn't on npm yet. The MUI package's first release needed `@zmnatz/usa-club-rugby-data` 0.4.0; the HTML package's needs 0.6.0.

## One-time npm setup for a component package

npm has to trust this repository before the workflow can publish a package. The data package is already set up. For `@zmnatz/usa-club-rugby-components` or `@zmnatz/usa-club-rugby-html`:

1. Sign in to npmjs.com with an account that can publish under the `@zmnatz` scope.
2. If the package doesn't exist yet and npm offers no way to add a trusted publisher for it, publish the first version by hand: run `bun run lib`, then `npm publish` in the package's directory under `packages/`.
3. Open the package's Settings, then Trusted Publisher, and choose GitHub Actions.
4. Enter this repository and the workflow file `publish.yml`, and leave `npm publish` unchecked, so the job can only stage a version for approval.
