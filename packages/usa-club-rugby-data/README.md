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
const ann = await client.player('12345');          // one player's verdict on every side they're listed on
const past = await client.seasons();               // the Locked Seasons published
```

The client reads each file once and keeps it. It reads through a `PublishedReader`, `(file) => Promise<unknown>`, given a path such as `clubs/rocky-gorge.json`. By default that is `httpReader({ baseUrl, fetch })`. Pass `read` for anything else: `fsReader(dir)` from `@zmnatz/usa-club-rugby-data/node` reads a checkout's `public/data`, and `memoryReader(files)` reads from an object, which is handy in tests. A reader rejects with `MissingPublishedFile` when a file isn't there.

```ts
import { fsReader } from '@zmnatz/usa-club-rugby-data/node';

const local = createPublishedClient({ read: fsReader('public/data') });
```

`playerIndex` and `player` work out every club's verdicts on the first lookup. Later lookups with the same options object, or with none, reuse them, so pass a new options object to count from a new `now`.

A player record carries `participation` (Match Participation: matches started plus matches entered as a substitute), `eligible`, `reasons` for a failure, `pending` for the matches an eligible player still needs, `cautions` when one more upper-side match would end an eligible player's eligibility for the rest of the season, and per-round detail in `rows[].rounds`.

Everything the client does is also a pure function: `clubSeason(snapshot, fixtures, club, { rules, now })` (verdicts, gaps and the club's fixtures under one set of rules; `now` is the only non-deterministic input, and a Locked Season ignores it), `computeBreakdown`, `parseTeamSide`, `possibleFixtures` and so on. The same inputs always give the same verdicts. Pass your own `EligibilityRules` to apply a different season's thresholds; `DEFAULT_RULES` are the 2026-27 Senior Club Regulations (§3.4.2, §3.5).

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

## Show a report in your own UI

The component packages render these; an app with its own UI can use them directly.

```ts
import { buildReport, filterPlayers, getColumns, sortPlayers } from '@zmnatz/usa-club-rugby-data';

const side = breakdown.sides[0];
const columns = getColumns(['D1'], 'record');                       // the table's columns, with each other side's count
const rows = sortPlayers(filterPlayers(side.players, 'caution'), 'participation', 'desc');
const text = buildReport(breakdown, { title: club.name, source: 'record', season, gaps, recordsUpdated }, new Date());
```

| Export | What |
| --- | --- |
| `getColumns`, `sortValue`, `sortsNumerically`, `otherSideCount` | A report table's columns and each cell's value |
| `sortPlayers`, `compareValues` | Sorting rows by a column; missing values sort last |
| `filterPlayers`, `matchesFilters`, `statusGroups` | The status filter (`all`, `eligible`, `caution`, `ineligible`) |
| `buildReport`, `gapText` | The exported text report, and a record gap as a sentence |
| `CAUTION_ADVICE` | What to tell a player under Caution |
| `formatDate`, `formatDateTime` | Dates in en-US and UTC, so a page reads the same on the server and in the browser |

`ReportSource` (`record` or `csv`) says where a report's rows came from: only a CSV report has USA IDs and registration dates.

## Games to chase, and forfeits

```ts
import { unreportedGames, rulesForSeason } from '@zmnatz/usa-club-rugby-data';

const games = unreportedGames({ fixtures, gaps, clubs, rules: rulesForSeason(season), now: new Date() });
```

| Export | What |
| --- | --- |
| `unreportedGames`, `UNREPORTED_LEEWAY_DAYS`, `FULL_SIDE` | This season's Qualifying Matches more than 14 days past kickoff with no result, a side with no lineup, or a side that listed more than 15 players with no substitute coming on. Forfeits, cancelled and postponed games and byes are left out. `gaps` is every club file's gaps; repeats are ignored |
| `competitionLabel` | A competition's name without its year, e.g. "2027 Midwest Men's D1 - Eastern" as "Midwest Men's D1 - Eastern" |
| `isForfeit`, `markForfeits`, `isPenaltyTryForfeit`, `FORFEIT_PENALTY_TRIES` | A forfeit: marked Forfeit in Rugby Xplorer, or entered as a result where one side scored nothing and every score was a penalty try, at least three. The nightly job marks the second kind Forfeit in the published fixtures, so Reg 3.4(h) applies to it |

A `no-substitutions` gap in a club file carries `rostered`, how many players that side listed.

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

The same operations are available from `@zmnatz/usa-club-rugby-data/node` (`runSnapshot`, `verifyPublished`, `publishFromArchive`, and `fsReader` for the client), which is the only entry point that touches the filesystem. The full walkthrough is in [docs/reproducing.md](https://github.com/zmnatz/usa-club-rugby-eligibility/blob/main/docs/reproducing.md).

## Development

```bash
bun install
bun run test      # in this package
bun run build     # dist/, ESM with declarations
```

Releases are published from GitHub releases by `.github/workflows/publish.yml`, using npm trusted publishing (no stored token). The workflow stages the version; approve it with 2FA on npmjs.com to release it.
