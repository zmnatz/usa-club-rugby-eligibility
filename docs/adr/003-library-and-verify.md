# The rules and data access are a published package, and the published data is checked against the archive

The report's engine lives in `packages/usa-club-rugby-data` and is published to npm as `@zmnatz/usa-club-rugby-data`, so other apps can read the teams and players and so the methodology can be run by anyone. The Next.js site is one consumer of it.

Decisions, so they are not "fixed" later:

- **A workspace package, not a copy**: the site and the nightly job import the same code that is published. There is one implementation of the rules.
- **No framework in the package**: no React, Next, MUI or `@/` aliases. Relative `.ts` imports are rewritten to `.js` at build, so `dist/` runs in Node 20+ and bundlers. The only filesystem code is under the `./node` export.
- **Rules and sources are TypeScript, not YAML**: `DEFAULT_RULES` and `DEFAULT_SOURCES` replace `config/*.yml`, so the package needs no loader and its consumers get types. Every function takes the rules it applies; the defaults are only defaults.
- **Reproducibility is the build**: `public/data/` is not committed; every build calculates it from `archive/` (`usa-club-rugby-data build`). `usa-club-rugby-data verify` remains for checking a published directory against the archive at its index's `generatedAt`, and the package's tests cover it, but CI no longer runs it on committed data.
- **The nightly job is a library function**: `runSnapshot` and `discoverFixtures` hold what `scripts/snapshot.ts` used to, so a fork runs the same pipeline with `usa-club-rugby-data snapshot`.
- **The app builds the package first**: `dist/` is not committed; `dev`, `build` and `typecheck` run `bun run lib`.
- **Published data is a stable interface**: the client reads `index.json`, `fixtures.json` and `clubs/<key>.json` from GitHub Pages. A change to their shape is a breaking change to the package.
