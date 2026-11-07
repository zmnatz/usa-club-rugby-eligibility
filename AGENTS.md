# Agent guidance: USA Club Rugby Eligibility

NCS player eligibility for every USA Club Rugby senior club, from the Rugby Xplorer match record, published as a static GitHub Pages site. Not specific to any club or union: don't add defaults, colours or copy for one.

## Commands

- `bun install`
- `bun run dev`: Next.js dev server. Uses only the committed nightly data, no CMS requests.
- `bun run build`: static build to `dist/`. `GITHUB_ACTIONS` or `BASE_PATH` sets the Pages base path.
- `bun run test`, `bun run lint`, `bun run typecheck`
- `bun run snapshot [--offline] [--full-history]`: see `docs/snapshots.md`.

## Structure

- `src/utils/eligibility.ts`: the rules. `src/__tests__/eligibility-regulation.test.ts` holds the regulations' Figure 1; a change that breaks a row is wrong.
- `src/utils/participation.ts`: Match Participation from match records, possible fixtures, the live pull.
- `src/utils/teamSide.ts`: club and division from a team name.
- `src/utils/feeds.ts`, `src/utils/archive.ts`, `scripts/snapshot.ts`: the nightly job.
- `src/utils/api.ts`: CMS requests and the shared rate-limit gate.
- `src/utils/published.ts`: reads the nightly data at build time for `getStaticPaths` and `getStaticProps`.
- `pages/`: the report. `index.tsx` lists the clubs, `[club].tsx` is one club's page at `/<club-key>`, `csv.tsx` reads a Match Participation Report, and `methodology.mdx` explains the rules. Routes are ordinary paths, so they work on the static host.
- `config/eligibility.yml`: thresholds and excluded competitions. `config/sources.yml`: the council and unions read each night.
- `archive/`, `public/data/`: generated nightly. Never hand-edit; regenerate.

## Docs

- `CONTEXT.md`: domain terms. Use them.
- `docs/adr/`: decisions, including ones carried from the Rocky Gorge tool (000). Read before changing a rule or the nightly job.
- Keep `src/pages/Methodology.mdx` in step with any change to the rules or data.
