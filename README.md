# USA Club Rugby Eligibility

**[usa-club-rugby-eligibility.netlify.app](https://usa-club-rugby-eligibility.netlify.app/)**

Which players are eligible for the National Championship Series, for every USA Club Rugby senior club, worked out from the lineups and substitutions entered in Rugby Xplorer. Pick a club, and click any player to check their count round by round against the Rugby Xplorer match reports. A Match Participation Report CSV can be checked too.

It applies the 2026-27 Senior Club Regulations (§3.4.2, §3.5) to clubs with any number of sides. Each club has its own page at `/club/<club-key>` (for example `/club/rocky-gorge/`) and each player in any record one at `/player/<cms-id>`, under no club because players move, and the page's [methodology](https://usa-club-rugby-eligibility.netlify.app/methodology/) explains the rules, the data and its limits.

**This is a guide, not an official tool.** The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## How the data is kept current

Each night a GitHub Action reads every senior club fixture from the Senior Club Council's, the unions' and the clubs' feeds, fetches every played match's record, archives the raw records in `archive/`, and merges the archive into `main`. Netlify builds and serves the site from every push to `main` (with a deploy preview for each pull request), calculating each club's participation from it into `public/data/` at build time. See [docs/snapshots.md](docs/snapshots.md).

## Use the data

The engine is published as [`@zmnatz/usa-club-rugby-data`](packages/usa-club-rugby-data/README.md): a typed client for the published teams, players and verdicts, the eligibility rules as pure functions, and a rate-limited CMS client.

The screens are published as [`@zmnatz/usa-club-rugby-components`](packages/usa-club-rugby-components/README.md): React and MUI components for the club directory, eligibility report and player detail, for any app built on that package. A plain HTML version, with one stylesheet and no UI framework, is [`@zmnatz/usa-club-rugby-html`](packages/usa-club-rugby-html/README.md); the site uses it.

```ts
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';
const players = await createPublishedClient().players('rocky-gorge');
```

## Reproducing the numbers

`bun run data` calculates all of `public/data` from the committed raw match archive; nothing else is stored. See [docs/reproducing.md](docs/reproducing.md).

## Development

```bash
bun install
bun run dev        # calculates the data from the committed archive
bun run test       # the package's tests
bun run snapshot   # refresh the data from the CMS
```

## Corrections

If a verdict looks wrong, first check the match reports linked in the player's dialog: most errors are lineups or substitutions missing in Rugby Xplorer, and correcting them there fixes the count the next night. Otherwise, open an issue with the club and player.
