# Nightly snapshot

The page is static. Its data is calculated each night by `usa-club-rugby-data snapshot` (`runSnapshot` in `packages/usa-club-rugby-data/src/node/snapshot.ts`) and committed, then GitHub Pages is rebuilt.

| Path | What | Published |
| --- | --- | --- |
| `archive/manifest.json` | Seasons archived, the current season, a hash of the queries, and the club ids whose feeds are read | No |
| `archive/fixtures/<season>.json` | Every senior club fixture that season, from all feeds, one per line | No |
| `archive/matches/<season>.json` | Every played match's full CMS record, one per line, `null` when the CMS has none | No |
| `public/data/index.json` | The current season's clubs and their sides, and when the data last changed | Yes |
| `public/data/fixtures.json` | The current season's fixtures | Yes |
| `public/data/clubs/<club>.json` | One club's Match Participation rows, gaps and result ids | Yes |
| `public/data/seasons.json` | The Locked Seasons published, newest first. Absent until the Archive holds one | Yes |
| `public/data/seasons/<slug>.json` | One Locked Season in a single file: its clubs, Unplaced Teams, fixtures and each club's Match Participation | Yes |

Each club's file becomes that club's page at `/club/<club-key>/` at build time, and each player in any of them a page at `/player/<cms-id>/` (except players whose name is withheld; under no club, since players change clubs; the page has a section for each club they appear in), so a report can be linked to and shared. Player pages are built from `public/data` at build time by the package's published client (`src/utils/published.ts`), which works out every club's verdicts once per build process, so each page's HTML carries its own verdict and match table (ADR 008).

## What a night does

`.github/workflows/pages.yml` runs at 06:00 UTC:

1. Reads the council and union feeds from the current season (ADR 001).
2. Fetches the record of every played match this season, finds clubs from their crests, reads those clubs' feeds, and repeats for any new results.
3. Writes the archive, then calculates `public/data/` from it. Files are written only when their content changes, so a quiet night makes no commit.
4. Runs `bun run verify` to check the published data reproduces from the archive.
5. Commits `archive` and `public/data` to `main` if anything changed, then builds and deploys Pages.

Every request has to succeed or nothing is written, so a failed night leaves the previous data in place. The log ends with the number of requests, rate-limit waits and total time.

A push to `main` only builds and deploys. The nightly job cannot push to `main` (it is protected), so it pushes a `snapshot/<run-id>` branch, opens a pull request and squash-merges it. This needs "Allow GitHub Actions to create and approve pull requests" under Settings > Actions > General. Pull requests made with `GITHUB_TOKEN` do not trigger other workflows, so any required status check must not be one that only runs on PRs, or the merge will wait forever (the job then falls back to auto-merge).

GitHub Pages occasionally stalls a deployment in `deployment_queued` or `syncing_files` for many minutes, where a normal one finishes in seconds. The deploy step waits 20 minutes, then retries once with the same artifact. If both time out, re-run the failed job: the artifact is named per attempt (`github-pages-<attempt>`), so a re-run doesn't collide with the earlier attempt's.

## Running it by hand

```bash
bun run snapshot                      # what the nightly job does
bun run snapshot --offline            # recalculate public/data from the archive, no CMS requests
bun run snapshot --full-history   # also read every past season the feeds list
SNAPSHOT_CONCURRENCY=8 bun run snapshot
```

The same options are inputs on the workflow's manual run (Actions, "Snapshot and deploy", Run workflow).

## Locked Seasons

The Archive can hold every season the feeds list. Each one from 2022-23 on is published as its own file, `public/data/seasons/<slug>.json`, with the regulations of its year (`rulesForSeason`, ADR 006), and read in the browser by the one `/season` page, as `/season?season=<slug>&club=<club-key>`, so past seasons add only one page to the build, plus a small stats page each at `/stats/<slug>/`, worked out at build time. The current season's files aren't affected. A Locked Season's files carry no timestamp, so later nights leave them alone.

To fill the archive:

```bash
bun run snapshot --full-history   # or run the workflow with "full_history" ticked
```

It makes thousands of CMS requests, so the workflow run is the better place for it than your own IP. Afterwards each season is in `archive/fixtures/<season>.json` and `archive/matches/<season>.json` and `manifest.json` lists them. A Locked Season is never read again by later nights, unless the requested fields change or another `--full-history` run asks. Both re-read every season in the Archive, so with many seasons filled in, editing `FEED_QUERY` or `MATCH_CENTRE_QUERY` costs a full backfill's worth of requests, and a `--full-history` rerun refetches seasons it already holds. Then commit `archive` and `public/data`; the workflow does this itself. The current season's published files stay the same, and `bun run verify` covers the new files too (`snapshot.test.ts`).

## Changing what's published

Change the calculation, run `bun run snapshot --offline`, check `bun run verify`, and commit `public/data`. No CMS requests are needed, because the archive holds the raw records.

## Changing what's requested

Editing `FEED_QUERY` or `MATCH_CENTRE_QUERY` changes the hash in the manifest, so the next run re-reads every archived season. Expect that run to take a while.

## Notes

- Don't hand-edit `archive/` or `public/data/`; regenerate them.
- The CMS rate limit is per IP: about 500 requests at once, then about 4 a second. The job batches 100 match records or 20 feed pages per request and waits the limit out; see ADR 001. A local run shares your IP's budget with anything else you're running against the CMS, such as the Rocky Gorge snapshots.
- GitHub disables a scheduled workflow after 60 days with no commits to the repository. The nightly commits keep it alive during the season; after a quiet off-season, re-enable it from the Actions tab.
