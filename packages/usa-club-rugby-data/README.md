# @zmnatz/usa-club-rugby-data

USA Club Rugby senior club **teams, players and NCS eligibility**, from the Rugby Xplorer match record. It is the engine behind [the eligibility report](https://zmnatz.github.io/usa-club-rugby-eligibility/), packaged so other apps can read the same data and so anyone can reproduce the numbers.

> A guide, not an official tool. The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

```bash
npm install @zmnatz/usa-club-rugby-data   # Node 20+, Bun, Deno or a bundler; no dependencies
```

## Read the published data

The nightly job publishes static JSON, so reading it costs nothing and has no rate limit.

```ts
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';

const client = createPublishedClient(); // or { baseUrl } for your own deployment

const clubs = await client.clubs();               // every club and its sides
const teams = await client.teams();               // every team, with parsed gender/division
const players = await client.players('rocky-gorge'); // a verdict per player per side
const report = await client.eligibility('rocky-gorge'); // the same, grouped by side
```

A player record carries `participation` (Match Participation: matches started plus matches entered as a substitute), `eligible`, `reasons` for a failure, `pending` for the matches an eligible player still needs, `cautions` when one more upper-side match would end an eligible player's eligibility for the rest of the season, and per-round detail in `rows[].rounds`.

Everything the client does is also a pure function: `clubEligibility(snapshot, fixtures, club, { rules, now })`, `computeBreakdown`, `parseTeamSide`, `possibleFixtures` and so on. The same inputs always give the same verdicts. Pass your own `EligibilityRules` to apply a different season's thresholds; `DEFAULT_RULES` are the 2026-27 Senior Club Regulations (§3.4.2, §3.5).

## Types for all of the data

Every file the pipeline reads or writes has a named type, and `@zmnatz/usa-club-rugby-data/types` exports them with no runtime code:

```ts
import type { PublishedClubFile, PublishedFixturesFile, PublishedIndexFile } from '@zmnatz/usa-club-rugby-data/types';
```

| File | Type |
| --- | --- |
| `index.json` | `PublishedIndexFile` |
| `fixtures.json` | `PublishedFixturesFile` (`FeedFixture[]`) |
| `clubs/<key>.json` | `PublishedClubFile` (`PlayerRow[]`, `ParticipationGap[]`) |
| `archive/manifest.json` | `ArchiveManifest` |
| `archive/fixtures/<season>.json` | `ArchiveFixturesFile` |
| `archive/matches/<season>.json` | `ArchiveMatchesFile` (the raw CMS record, `MatchCentreData`) |

The verdict types (`PlayerEligibility`, `EligibilityRules`, `Side`, `Club`) are there too. They are also exported from the main entry point.

## Pull live from the CMS

```ts
import { discoverFixtures, fetchClubRecord } from '@zmnatz/usa-club-rugby-data';

const { fixtures, matches } = await discoverFixtures({ fromSeason: '2026/2027' }); // the nightly job's pull
const record = await fetchClubRecord(club, fixtures, { saved: snapshot });          // one club, counted now
```

Requests share one rate-limit gate (the CMS allows about 500 requests at once, then about 4 a second per IP), and a pull throws rather than return a partial count. A full `discoverFixtures` run is thousands of requests; prefer the published data unless you need something fresher.

## Reproduce the published data

```bash
npx @zmnatz/usa-club-rugby-data verify --archive archive --published public/data
```

`verify` recalculates every published file from the raw match archive, at the time recorded in the published index, and fails on any difference. Other commands:

| Command | What |
| --- | --- |
| `snapshot [--offline] [--full-history]` | Refresh the archive from the CMS, then calculate the published data |
| `build` | Calculate the published data from the archive alone (`snapshot --offline`) |
| `verify` | Recalculate and compare; exit 1 on any difference |
| `rules` | Print the rules and sources in effect |

The same operations are available from `@zmnatz/usa-club-rugby-data/node` (`runSnapshot`, `verifyPublished`, `publishFromArchive`), which is the only entry point that touches the filesystem. The full walkthrough is in [docs/reproducing.md](https://github.com/zmnatz/usa-club-rugby-eligibility/blob/main/docs/reproducing.md).

## Development

```bash
bun install
bun run test      # in this package
bun run build     # dist/, ESM with declarations
```

Releases are published from GitHub releases by `.github/workflows/publish.yml`, using npm trusted publishing (no stored token). The workflow stages the version; approve it with 2FA on npmjs.com to release it.
