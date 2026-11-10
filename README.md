# USA Club Rugby Eligibility

**[zmnatz.github.io/usa-club-rugby-eligibility](https://zmnatz.github.io/usa-club-rugby-eligibility/)**

Which players are eligible for the National Championship Series, for every USA Club Rugby senior club, worked out from the lineups and substitutions entered in Rugby Xplorer. Pick a club, and click any player to check their count round by round against the Rugby Xplorer match reports. A Match Participation Report CSV can be checked too.

It applies the 2026-27 Senior Club Regulations (§3.4.2, §3.5) to clubs with any number of sides. Each club has its own page at `/club/<club-key>` (for example `/club/rocky-gorge/`) and each player in any record one at `/player?id=<cms-id>`, under no club because players move, and the page's [methodology](https://zmnatz.github.io/usa-club-rugby-eligibility/methodology/) explains the rules, the data and its limits.

**This is a guide, not an official tool.** The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## How the data is kept current

Each night a GitHub Action reads every senior club fixture from the Senior Club Council's, the unions' and the clubs' feeds, fetches every played match's record, archives the raw records in `archive/`, calculates each club's participation into `public/data/`, and redeploys the page. See [docs/snapshots.md](docs/snapshots.md).

## Use the data

The engine is published as [`@zmnatz/usa-club-rugby-data`](packages/usa-club-rugby-data/README.md): a typed client for the published teams, players and verdicts, the eligibility rules as pure functions, and a rate-limited CMS client.

The screens are published as [`@zmnatz/usa-club-rugby-components`](packages/usa-club-rugby-components/README.md): React and MUI components for the club directory, eligibility report and player detail, for any app built on that package.

```ts
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';
const players = await createPublishedClient().players('rocky-gorge');
```

## Reproducing the numbers

`bun run verify` recalculates all of `public/data` from the committed raw match archive and fails on any difference, and [a notebook](notebooks/reproduce-eligibility.ipynb) recounts a club independently in plain Python. See [docs/reproducing.md](docs/reproducing.md).

## Development

```bash
bun install
bun run dev        # uses the committed nightly data
bun run test       # the package's tests
bun run verify     # published data reproduces from the archive
bun run snapshot   # refresh the data from the CMS
```

## Corrections

If a verdict looks wrong, first check the match reports linked in the player's dialog: most errors are lineups or substitutions missing in Rugby Xplorer, and correcting them there fixes the count the next night. Otherwise, open an issue with the club and player.
