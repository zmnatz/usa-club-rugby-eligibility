# Agent guidance: USA Club Rugby Eligibility

NCS player eligibility for every USA Club Rugby senior club, from the Rugby Xplorer match record, served by Netlify's Next.js runtime (ADR 012). Not specific to any club or union: don't add defaults, colours or copy for one.

## Commands

- `bun install`
- `bun run dev`: Next.js dev server. Uses only the archive's data, calculated locally; no CMS requests.
- `bun run build`: `next build` to `.next/`, which Netlify serves; `next start` runs it locally. Netlify builds every push to `main` and a deploy preview for each pull request. Club, player and Locked Season pages, and a Locked Season's stats page, aren't built: each is generated on its first request and cached until the next deploy (ADRs 014, 015, 016). The all-seasons stats page, `/stats/`, is rendered on request and cached by the CDN until the next deploy (ADR 018); every other page is generated at build time. So there is one build, quick enough to check a change locally, and it covers every page.
- `bun run test`, `bun run lint`, `bun run typecheck`
- `bun run snapshot [--offline] [--full-history]`: refreshes `archive` from the CMS (with `--offline`, recalculates `public/data` from it); see `docs/snapshots.md`.
- `bun run data`: calculates `public/data` from `archive` (no CMS requests). It is gitignored, not committed; `dev` and `build` run it first, so a change to the rules shows up on the next run.
- `node test/ci/data-diff.ts --base <dir> --head <dir> --out <file>`: compares two built `public/data` directories, ignoring the build stamp; `test/ci/changes-page.ts` adds the report to `pages/changes.mdx`. Both run in CI.
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
- `packages/usa-club-rugby-html/`: the site's eligibility screens, a plain HTML version of the MUI package's, published to npm as `@zmnatz/usa-club-rugby-html` (ADRs 009, 010). Components only: React with semantic HTML and one stylesheet (`src/styles.css`, exported as `@zmnatz/usa-club-rugby-html/styles.css`, `ec-` classes on `--ec-*` variables). Logic with no UI goes in the data package. No MUI or Emotion, no Next.js imports, `@/` aliases or route strings (`src/boundaries.test.ts` fails on them). Relative imports end in `.ts` or `.tsx`. Use CSS where it does the job (`<details>`, anchors) and React state for the rest, including filters; the site ships no script of its own (ADR 010). Every `ec-table` must read at phone width (390px) with no page-wide sideways scroll: a table of records gets `ec-table-stack` and a `data-label` on every cell, so each row stacks into a labelled card under 600px; a sortable or by-column table gets `ec-table-sticky`, which keeps its first column in view as it scrolls.
- `src/utils/published.ts`: the package's published client over `public/data` (`fsReader`), for `getStaticProps`, at build time and in the functions that generate club, player and Locked Season pages on request. `next.config.ts` lists the files each of those routes reads (`outputFileTracingIncludes`), since Next can't trace them.
- `src/styles/site.css`, `src/components/`: the site's own chrome, prose and links. `pages/`: the report. `index.tsx` lists the clubs, `club/[club]/index.tsx` is one club's page at `/club/<club-key>`, `player/[player]/index.tsx` one player's at `/player/<cms-id>` and `player/[player]/[season]/index.tsx` their Locked Season at `/player/<cms-id>/<season-slug>`, all generated on first request (ADRs 008, 014, 015, 017), `season/index.tsx` lists the Locked Seasons, `season/[season]/index.tsx` one's clubs at `/season/<season-slug>` and `season/[season]/[club]/index.tsx` a club's final report at `/season/<season-slug>/<club-key>`, both generated on first request (ADR 016), with `proxy.ts` redirecting the old URLs that named a page by query (`legacyRedirect`), `stats/[season]/index.tsx` its stats at `/stats/<season-slug>`, also generated on first request (ADR 016), and `stats/index.tsx` every season's side by side, rendered on request (ADR 018), `csv.tsx` reads a Match Participation Report, `methodology.mdx` explains the rules, and `changes.mdx` holds the last 14 nightly data changes. Routes are ordinary paths with a trailing slash, as they were on the old static host.
- `test/ci/`: the CI helpers for the published data: `data-diff.ts` compares two builds for the PR comment, and `changes-page.ts` adds one night's entry to `pages/changes.mdx`. Their logic is in `test/ci/lib/` with tests.
- `archive/`: the raw match record, refreshed and committed nightly. Never hand-edit; regenerate. `public/data/`: calculated from it at build time, gitignored. The pages generated on request read it at request time, so each such route must list the files it reads in `outputFileTracingIncludes` in `next.config.ts` (and exclude the ones it doesn't).

## State is in the URL

- Everything a visitor can change that affects what a page shows lives in the URL, so Back and Forward step through it and a link shares it: a filter or sort, a toggle. A season, club or player is a page with its own path (`/season/<season-slug>/<club-key>`, `/player/<cms-id>/<season-slug>`), not a query. For the rest use a query parameter on the page, read it from the router, and change it by link or `router.push(..., { shallow: true, scroll: false })`. Don't hold it in `useState`, `localStorage` or a hidden variable.
- The page's default (no parameter) is what the static HTML shows, so prerender and first hydration match. An unknown value falls back to the default.
- Parameter names and the helpers that build and read them are in `src/utils/paths.ts`. The component packages take the value and a way to change it as props, and keep no state of their own for it (ADR 010). Existing filters, sorts and toggles in `packages/usa-club-rugby-html/` still use React state; move them to the URL when you change them.

## Docs

- `GLOSSARY.md`: domain terms. Use them.
- `docs/adr/`: decisions, including ones carried from the Rocky Gorge tool (000). Read before changing a rule, the nightly job or the package.
- `docs/reproducing.md`: the pipeline from CMS to verdict and how to check each stage.
- `docs/releasing.md`: releasing the npm packages together from a tagged GitHub release.
- Keep `pages/methodology.mdx` in step with any change to the rules or data.
- A change to the shape of the published JSON, or to an export of the package, is a breaking change to the npm package, so its next release is a new minor version (a new major from 1.0). The same goes for the exports of the two component packages. The packages share one version, which lives only in release tags (`v<version>`, see `docs/releasing.md`), not in `package.json`: don't add one, and keep the component packages' peer on the data package at `workspace:*`. Say in the PR when a change is breaking.

## Pull Requests

- CI screenshots each PR at desktop and mobile sizes and keeps one comment on it up to date, from a build made inside the job and served with `next start`. For a PR that changes UI, add a `## Screenshots` section to the description listing the pages to capture, one path per line (e.g. `/csv/`). Any club or player page can be listed (`/club/<club-key>/`, `/player/<cms-id>/`), since they are generated on request.
- Add `wait: <selector>` or `delay: <ms>` after a path for pages that fill in after load.
- Without the section the run captures `/` plus any routes mapped from changed files in `test/playwright/config/screenshots.yml`.
- The `data-diff` job builds `public/data` from the PR's base and head and keeps one comment on the PR up to date with what changed, from `test/ci/data-diff.ts`. It detects its comment by `<!-- pr-data-diff -->`. The nightly job appends the same report to `pages/changes.mdx`, keeping the last 14 entries.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on this repo, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
