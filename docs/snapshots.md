# Nightly snapshot

The page is static. Its data is calculated each night by `scripts/snapshot.ts` and committed, then GitHub Pages is rebuilt.

| Path | What | Published |
| --- | --- | --- |
| `archive/manifest.json` | Seasons archived, the current season, a hash of the queries, and the club ids whose feeds are read | No |
| `archive/fixtures/<season>.json` | Every senior club fixture that season, from all feeds, one per line | No |
| `archive/matches/<season>.json` | Every played match's full CMS record, one per line, `null` when the CMS has none | No |
| `public/data/index.json` | The current season's clubs and their sides, and when the data last changed | Yes |
| `public/data/fixtures.json` | The current season's fixtures | Yes |
| `public/data/clubs/<club>.json` | One club's Match Participation rows, gaps and result ids | Yes |

## What a night does

`.github/workflows/pages.yml` runs at 06:00 UTC:

1. Reads the council and union feeds from the current season (ADR 001).
2. Fetches the record of every played match this season, finds clubs from their crests, reads those clubs' feeds, and repeats for any new results.
3. Writes the archive, then calculates `public/data/` from it. Files are written only when their content changes, so a quiet night makes no commit.
4. Commits `archive` and `public/data` to `main` if anything changed, then builds and deploys Pages.

Every request has to succeed or nothing is written, so a failed night leaves the previous data in place. The log ends with the number of requests, rate-limit waits and total time.

A push to `main` only builds and deploys.

## Running it by hand

```bash
bun run snapshot                      # what the nightly job does
bun run snapshot --offline            # recalculate public/data from the archive, no CMS requests
bun run snapshot --full-history       # also read every past season the feeds list
SNAPSHOT_CONCURRENCY=8 bun run snapshot
```

The same options are inputs on the workflow's manual run (Actions, "Snapshot and deploy", Run workflow).

## Changing what's published

Change the calculation, run `bun run snapshot --offline`, and commit `public/data`. No CMS requests are needed, because the archive holds the raw records.

## Changing what's requested

Editing `FEED_QUERY` or `MATCH_CENTRE_QUERY` changes the hash in the manifest, so the next run re-reads every archived season. Expect that run to take a while.

## Notes

- Don't hand-edit `archive/` or `public/data/`; regenerate them.
- The CMS rate limit is per IP: about 500 requests at once, then about 4 a second. The job batches 100 match records or 20 feed pages per request and waits the limit out; see ADR 001. A local run shares your IP's budget with anything else you're running against the CMS, such as the Rocky Gorge snapshots.
- GitHub disables a scheduled workflow after 60 days with no commits to the repository. The nightly commits keep it alive during the season; after a quiet off-season, re-enable it from the Actions tab.
