# Reproducing the report

Every number on the site can be rebuilt from public inputs. This is the pipeline, what each stage reads and writes, and how to check each one.

```
Rugby Xplorer CMS ──snapshot──▶ archive/ (raw) ──build──▶ public/data/ (published) ──library──▶ verdicts
                                    ▲                          ▲                          ▲
                              committed nightly         `bun run data` builds it     clubSeason()
```

| Stage | Input | Output | Deterministic |
| --- | --- | --- | --- |
| 1. Read feeds | Council, union and club feeds in the CMS (`DEFAULT_SOURCES`) | Every senior club fixture, merged | No: the CMS changes. This is the only stage that touches the network |
| 2. Fetch records | Each played fixture | Raw match record (lineup, substitutes, coaches, commentary) in `archive/matches/<season>.json` | No, same reason |
| 3. Count participation | `archive/` + `DEFAULT_RULES` + a time | `public/data/clubs/<club>.json`, `fixtures.json`, `index.json` | **Yes** |
| 4. Verdicts | A published club file + fixtures + rules + a time | Eligible / not, reasons, matches still needed | **Yes** |

Stages 1 and 2 are frozen into the archive by committing it, which is what makes the rest reproducible: everything after is a pure function of the archive and the rules, calculated as of the manifest's `pulledAt`. `public/data/` is not committed. Every `dev` and `build` calculates it from the archive (`bun run data`), so a rule change shows up with no regeneration step to forget. An archive made before `pulledAt` was recorded has no stamp, and the one build over it falls back to the build's own time; the next snapshot records one.

## Calculate the published data

```bash
git clone https://github.com/zmnatz/usa-club-rugby-eligibility && cd usa-club-rugby-eligibility
bun install
bun run data           # calculates public/data from archive/
```

To check a directory of published data against the archive, run `usa-club-rugby-data verify --published <dir>`: it fails if a file differs from the recalculation (at the index's `generatedAt`), is missing, or has no source in the archive.

## Rebuild after changing a rule

```bash
bun run test           # the regulation's Figure 1 table must still pass
bun run data           # recalculate public/data from the archive; no CMS requests
```

Rules are data: the thresholds and excluded competitions are `DEFAULT_RULES` in `packages/usa-club-rugby-data/src/rules.ts`, and every function takes the rules it applies, so a different season's rules can be tried without touching the code.

## See what a change does

A rules change is no longer a data diff in the pull request. CI builds `public/data` from the branch's base and head, compares the two (`test/ci/data-diff.ts`) and comments the result. To do the same locally:

```bash
git switch --detach <base-commit>
bun install && bun run data && mv public/data /tmp/data-base
git switch <branch>
bun install && bun run data
node test/ci/data-diff.ts --base /tmp/data-base --head public/data --out report.md
```

The nightly job runs the same comparison and adds its result to `pages/changes.mdx`, which keeps the last 14 nights.

## Locked Seasons

Each Locked Season from 2022-23 is published under its own regulations; see "Locked Seasons" in [snapshots.md](snapshots.md) and ADR 006. To recount one, read it with `readSeason(archiveDir, season)` (from `/node`) and pass it to `buildLockedSeason`, which uses `rulesForSeason(season)` unless given other rules.

## Rebuild from scratch

```bash
bun run snapshot --full-history   # reads the CMS: thousands of requests at about 4 a second
```

The CMS only serves current records, so a fresh pull can differ from the committed archive wherever Rugby Xplorer has since corrected a lineup. That is the reason the raw archive is committed (docs/adr/002-raw-match-archive.md).

## Use the data from your own code

See [packages/usa-club-rugby-data/README.md](../packages/usa-club-rugby-data/README.md): a typed client for the published JSON, the pure rule functions, and a rate-limited live CMS client.
