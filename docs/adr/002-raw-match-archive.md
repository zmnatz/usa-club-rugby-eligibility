# The raw match records are archived, and everything published is calculated from them

Rocky Gorge issue #224 found that keeping only calculated results meant a format change re-downloaded every match. Nationally that is several thousand requests at about 4 a second. So the nightly job saves each played match's full CMS record (score, clubs, lineup with positions and shirt numbers, substitutes, coaches and the whole commentary, including substitution events) to `archive/`, and the published data in `public/data/` is calculated from the archive alone. `bun run snapshot --offline` rebuilds it with no CMS requests.

Layout: `archive/manifest.json`, then per season `archive/<season>/fixtures.json` and `archive/<season>/matches/<fixture id>.json`. One file per match keeps a night's commit to the matches that changed.

Decisions, so they are not "fixed" later:

- **Committed, not published**: the archive is build data. It lives outside `public/`, so Pages never serves it.
- **Current season re-read every night**: the CMS shows no sign of what changed and late corrections affect verdicts, so every result in the current season is fetched again.
- **Locked seasons**: a season gets one last read as the next begins, then is never fetched again, unless the fields requested change (the manifest holds a hash of the queries, so editing a query re-reads every archived season) or a `--full-history` run asks.
- **First run**: reads the latest season only. A manual `--full-history` run fills in past seasons.
- **A match with no record**: archived as `null`, so it isn't requested again for a locked season, and published as a "no lineup" gap.
- **All or nothing**: nothing is written until every request has succeeded.
