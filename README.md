# USA Club Rugby Eligibility

**[zmnatz.github.io/usa-club-rugby-eligibility](https://zmnatz.github.io/usa-club-rugby-eligibility/)**

Which players are eligible for the National Championship Series, for every USA Club Rugby senior club, worked out from the lineups and substitutions entered in Rugby Xplorer. Pick a club, and click any player to check their count round by round against the Rugby Xplorer match reports. A Match Participation Report CSV can be checked too.

It applies the 2026-27 Senior Club Regulations (§3.4.2, §3.5) to clubs with any number of sides. Each club has its own page at `/<club-key>` (for example `/rocky-gorge/`), and the page's [methodology](https://zmnatz.github.io/usa-club-rugby-eligibility/methodology/) explains the rules, the data and its limits.

**This is a guide, not an official tool.** The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## How the data is kept current

Each night a GitHub Action reads every senior club fixture from the Senior Club Council's, the unions' and the clubs' feeds, fetches every played match's record, archives the raw records in `archive/`, calculates each club's participation into `public/data/`, and redeploys the page. See [docs/snapshots.md](docs/snapshots.md).

## Development

```bash
bun install
bun run dev        # uses the committed nightly data
bun run test
bun run snapshot   # refresh the data from the CMS
```

## Corrections

If a verdict looks wrong, first check the match reports linked in the player's dialog: most errors are lineups or substitutions missing in Rugby Xplorer, and correcting them there fixes the count the next night. Otherwise, open an issue with the club and player.
