# Agent guidance: USA Club Rugby Eligibility

NCS player eligibility for every USA Club Rugby senior club, from the Rugby Xplorer match record, published as a static GitHub Pages site. Not specific to any club or union: don't add defaults, colours or copy for one.

## Commands

- `bun install`
- `bun run dev`: Next.js dev server. Uses only the committed nightly data, no CMS requests.
- `bun run build`: static build to `dist/`. `GITHUB_ACTIONS` or `BASE_PATH` sets the Pages base path.
- `bun run build:quick`: the same build for the first 5 clubs and their players, for checking a change locally. `BUILD_CLUBS` sets the scope to a number of clubs or a comma-separated list of club keys. Its `dist/` is incomplete, so don't deploy it; CI ignores the setting.
- `bun run test`, `bun run lint`, `bun run typecheck`
- `bun run snapshot [--offline] [--full-history]`: see `docs/snapshots.md`.
- `bun run verify`: recalculates `public/data` from `archive` and fails on any difference. Run it after any change to the rules or the calculation.
- `bun run lib`: builds the three packages in `packages/` to their `dist/`. The component packages build incrementally, so an unchanged rebuild is quick. `dev`, `build`, `typecheck` and `test` do it first; `test` runs the data package's tests and the component tests in `src/`, `packages/usa-club-rugby-components/` and `packages/usa-club-rugby-html/`. `bun run dev` serves the HTML package's last build, so rerun `bun run lib` after changing it.

## Structure

- `packages/usa-club-rugby-data/`: the engine, published to npm as `@zmnatz/usa-club-rugby-data`. Framework-free (no React, Next or `@/` aliases); relative imports end in `.ts`. The site imports it by that name, so it must be built (`bun run lib`) first.
  - `src/eligibility.ts`: the rules. `src/__tests__/eligibility-regulation.test.ts` holds the regulations' Figure 1; a change that breaks a row is wrong.
  - `src/rules.ts`, `src/sources.ts`: `DEFAULT_RULES` (thresholds, excluded competitions) and `DEFAULT_SOURCES` (the council and unions read each night).
  - `src/qualifying.ts`: what counts as a Qualifying Match. The rule most likely to change by season (ADR 006).
  - `src/snapshot.ts`: Match Participation and its gaps from match records. `src/clubFixtures.ts`: clubs, their sides and fixtures, and one club's slice of the record.
  - `src/schedule.ts`: possible, remaining and scheduled matches. `src/clubReport.ts`: a club's and a player's verdicts from the record, and a player's rounds.
  - `src/teamSide.ts`: club and division from a team name. `src/historicalSides.ts`: the same for a Locked Season, using competition names (ADR 006).
  - `src/feeds.ts`, `src/archive.ts`, `src/live.ts`: the nightly pull. `live.ts` also has the live pull of one club's record (`loadClubRecord`). `src/api.ts`: CMS requests and the shared rate-limit gate.
  - `src/published.ts`: the client for the published data, over a `PublishedReader` (`httpReader`, `memoryReader`; `fsReader` is in `src/node/`). Its file shapes are a public interface.
  - `src/reportModel.ts`, `src/sort.ts`, `src/dates.ts`: a report's columns, sorting, filtering and export text, and dates that read the same on the server and in the browser. Both component packages render them.
  - `src/node/`: the only filesystem code: `runSnapshot`, `verifyPublished`. `src/cli.ts` is the `usa-club-rugby-data` command.
- `packages/usa-club-rugby-components/`: the eligibility UI, published to npm as `@zmnatz/usa-club-rugby-components`. React and MUI, with its peers supplied by the host. Components only: logic with no UI goes in the data package. No Next.js imports or `@/` aliases (`src/boundaries.test.ts` fails on them), and no colours, defaults or copy for one club or union. Relative imports end in `.ts` or `.tsx`. Use standard MUI components with layout on their props, so every screen renders properly under MUI's default theme; a theme only changes the look. See ADR 005. The site doesn't use it (ADR 009).
- `packages/usa-club-rugby-html/`: the site's eligibility screens, a plain HTML version of the MUI package's, published to npm as `@zmnatz/usa-club-rugby-html` (ADRs 009, 010). Components only: React with semantic HTML and one stylesheet (`src/styles.css`, exported as `@zmnatz/usa-club-rugby-html/styles.css`, `ec-` classes on `--ec-*` variables). Logic with no UI goes in the data package. No MUI or Emotion, no Next.js imports, `@/` aliases or route strings (`src/boundaries.test.ts` fails on them). Relative imports end in `.ts` or `.tsx`. Use CSS where it does the job (`<details>`, anchors) and React state for the rest, including filters; the site ships no script of its own (ADR 010).
- `src/utils/published.ts`: the package's published client over `public/data` (`fsReader`), for `getStaticPaths` and `getStaticProps` at build time.
- `src/styles/site.css`, `src/components/`: the site's own chrome, prose and links. `pages/`: the report. `index.tsx` lists the clubs, `club/[club]/index.tsx` is one club's page at `/club/<club-key>`, `player/[player]/index.tsx` one player's at `/player/<cms-id>`, built statically (ADR 008), `season.tsx` shows a Locked Season, loaded in the browser from its one file and chosen by query params, `stats/[season]/index.tsx` its stats, built statically, `csv.tsx` reads a Match Participation Report, and `methodology.mdx` explains the rules. Routes are ordinary paths, so they work on the static host.
- `archive/`, `public/data/`: generated nightly. Never hand-edit; regenerate.

## Docs

- `GLOSSARY.md`: domain terms. Use them.
- `docs/adr/`: decisions, including ones carried from the Rocky Gorge tool (000). Read before changing a rule, the nightly job or the package.
- `docs/reproducing.md`: the pipeline from CMS to verdict and how to check each stage.
- `docs/releasing.md`: releasing each npm package from a tagged GitHub release.
- Keep `pages/methodology.mdx` in step with any change to the rules or data.
- A change to the shape of the published JSON, or to an export of the package, is a breaking change to the npm package: bump its version. The same goes for the exports of the two component packages. Bump a version only if its current version has been released, that is, its tag (`<package>-v<version>`, see `docs/releasing.md`) exists. An unreleased version already carries the change.

## Pull Requests

- CI screenshots each PR at desktop and mobile sizes and keeps one comment on it up to date, from a partial build made inside the job. For a PR that changes UI, add a `## Screenshots` section to the description listing the pages to capture, one path per line (e.g. `/csv/`). Any `/club/<club-key>/` or `/player/<cms-id>/` listed there adds that club, or the player's clubs, to the build.
- Add `wait: <selector>` or `delay: <ms>` after a path for pages that fill in after load.
- Without the section the run captures `/` plus any routes mapped from changed files in `test/playwright/config/screenshots.yml`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on this repo, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
