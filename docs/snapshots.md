# Nightly snapshot

The pages are static or cached per deploy. The data is calculated as of the archive's `pulledAt`, not the build time, so the site's "as of" date is the last pull and the same archive always gives the same files. Each night `usa-club-rugby-data snapshot` (`runSnapshot` in `packages/usa-club-rugby-data/src/node/snapshot.ts`) refreshes the raw match archive, which is committed, and the merge into `main` makes Netlify rebuild the site (ADR 012). Every build calculates `public/data` from the archive (`bun run data`); that directory is gitignored, never committed.

| Path | What | Published |
| --- | --- | --- |
| `archive/manifest.json` | Seasons archived, the current season, a hash of the queries, the club ids whose feeds are read, and when the archive was last pulled (`pulledAt`) | No |
| `archive/fixtures/<season>.json` | Every senior club fixture that season, from all feeds, one per line | No |
| `archive/matches/<season>.json` | Every played match's full CMS record, one per line, `null` when the CMS has none | No |
| `public/data/index.json` | The current season's clubs and their sides, and when the archive was last pulled | Yes |
| `public/data/fixtures.json` | The current season's fixtures | Yes |
| `public/data/clubs/<club>.json` | One club's Match Participation rows, gaps and result ids | Yes |
| `public/data/seasons.json` | The Locked Seasons published, newest first. Absent until the Archive holds one | Yes |
| `public/data/seasons/<slug>.json` | One Locked Season in a single file: its clubs, Unplaced Teams, fixtures and each club's Match Participation | Yes |

Each club's file becomes that club's page at `/club/<club-key>/`, generated the first time it is requested after a deploy and cached until the next (ADR 013), and each player in any of them a page at `/player/<cms-id>/` (except players whose name is withheld; under no club, since players change clubs; the page has a section for each club they appear in), so a report can be linked to and shared. Player pages are built from `public/data` at build time by the package's published client (`src/utils/published.ts`), which works out every club's verdicts once per build process, so each page's HTML carries its own verdict and match table (ADR 008).

## What a night does

`.github/workflows/snapshot.yml` runs at 06:00 UTC:

1. Reads the council and union feeds from the current season (ADR 001).
2. Fetches the record of every played match this season, finds clubs from their crests, reads those clubs' feeds, and repeats for any new results.
3. Writes the archive. Season files are written only when their content changes, but the manifest's `pulledAt` moves on every read, so a night that reaches the CMS commits a new manifest even when no record changed.
4. Compares the data built from the previous archive with the data built from the new one (`test/ci/data-diff.ts`). If they differ, adds the report as the newest entry on `pages/changes.mdx`, keeping the last 14.
5. Commits `archive` and the changes page to `main` if anything changed. Netlify builds that push (which calculates `public/data` from it) and deploys it.

Every request has to succeed or nothing is written, so a failed night leaves the previous data in place. The log ends with the number of requests, rate-limit waits and total time.

Every push to `main` deploys on Netlify, and every pull request gets a deploy preview; neither runs the snapshot. The nightly job cannot push to `main` (it is protected), so it pushes a `snapshot/<run-id>` branch, opens a pull request and squash-merges it. This needs "Allow GitHub Actions to create and approve pull requests" under Settings > Actions > General. Pull requests made with `GITHUB_TOKEN` do not trigger other workflows, so any required status check must not be one that only runs on PRs, or the merge will wait forever (the job then falls back to auto-merge).

Netlify builds a push to `main` through its GitHub integration, not a workflow, so a merge made with `GITHUB_TOKEN` still deploys. If a deploy fails, retry it from the Netlify dashboard; the archive is already on `main`.

## Running it by hand

```bash
bun run snapshot                      # what the nightly job does
bun run data                          # calculate public/data from the archive, no CMS requests
bun run snapshot --full-history   # also read every past season the feeds list
SNAPSHOT_CONCURRENCY=8 bun run snapshot
```

`--full-history` is an input on the workflow's manual run (Actions, "Snapshot and deploy", Run workflow).

## Locked Seasons

The Archive can hold every season the feeds list. Each one from 2022-23 on is published as its own file, `public/data/seasons/<slug>.json`, with the regulations of its year (`rulesForSeason`, ADR 006), and read in the browser by the one `/season` page, as `/season?season=<slug>&club=<club-key>`, so past seasons add only one page to the build, plus a small stats page each at `/stats/<slug>/`, worked out at build time. The current season's files aren't affected. A Locked Season's files carry no timestamp, so later nights leave them alone.

To fill the archive:

```bash
bun run snapshot --full-history   # or run the workflow with "full_history" ticked
```

It makes thousands of CMS requests, so the workflow run is the better place for it than your own IP. Afterwards each season is in `archive/fixtures/<season>.json` and `archive/matches/<season>.json` and `manifest.json` lists them. A Locked Season is never read again by later nights, unless the requested fields change or another `--full-history` run asks. Both re-read every season in the Archive, so with many seasons filled in, editing `FEED_QUERY` or `MATCH_CENTRE_QUERY` costs a full backfill's worth of requests, and a `--full-history` rerun refetches seasons it already holds. Then commit `archive`; the workflow does this itself.

## Changing what's published

Change the calculation and run `bun run data`: nothing is committed but the code. No CMS requests are needed, because the archive holds the raw records.

## Changing what's requested

Editing `FEED_QUERY` or `MATCH_CENTRE_QUERY` changes the hash in the manifest, so the next run re-reads every archived season. Expect that run to take a while.

## Notes

- Don't hand-edit `archive/` or `public/data/`; regenerate them.
- The CMS rate limit is per IP: about 500 requests at once, then about 4 a second. The job batches 100 match records or 20 feed pages per request and waits the limit out; see ADR 001. A local run shares your IP's budget with anything else you're running against the CMS, such as the Rocky Gorge snapshots.
- GitHub disables a scheduled workflow after 60 days with no commits to the repository. The nightly manifest commit keeps it alive, even in a quiet off-season.
