# Reproducing the report

Every number on the site can be rebuilt from public inputs. This is the pipeline, what each stage reads and writes, and how to check each one.

```
Rugby Xplorer CMS ──snapshot──▶ archive/ (raw) ──build──▶ public/data/ (published) ──library──▶ verdicts
                                    ▲                          ▲                          ▲
                              committed nightly         `verify` recalculates it     clubEligibility()
```

| Stage | Input | Output | Deterministic |
| --- | --- | --- | --- |
| 1. Read feeds | Council, union and club feeds in the CMS (`DEFAULT_SOURCES`) | Every senior club fixture, merged | No: the CMS changes. This is the only stage that touches the network |
| 2. Fetch records | Each played fixture | Raw match record (lineup, substitutes, coaches, commentary) in `archive/matches/<season>.json` | No, same reason |
| 3. Count participation | `archive/` + `DEFAULT_RULES` + a time | `public/data/clubs/<club>.json`, `fixtures.json`, `index.json` | **Yes** |
| 4. Verdicts | A published club file + fixtures + rules + a time | Eligible / not, reasons, matches still needed | **Yes** |

Stages 1 and 2 are frozen into the archive by committing it, which is what makes the rest reproducible: everything after is a pure function of the archive, the rules and a timestamp. The timestamp is the published `index.json`'s `generatedAt`, which only moves when the published data changes, so recalculating at that time gives the same files.

## Check the published data

```bash
git clone https://github.com/zmnatz/usa-club-rugby-eligibility && cd usa-club-rugby-eligibility
bun install
bun run verify         # OK: 315 published files reproduce from the archive (as of ...)
```

`verify` fails if a published file differs from the recalculation, is missing, or has no source in the archive. CI runs it on every pull request and the nightly job runs it before committing, so a rule change or hand edit can't be merged without regenerating `public/data/`.

## Recount one club independently

[`notebooks/reproduce-eligibility.ipynb`](../notebooks/reproduce-eligibility.ipynb) recounts a club's Match Participation from the raw archive in about 100 lines of standard-library Python, with none of this repository's code, and compares every row with the published file. Use it to audit the implementation against the written rules (starters, substitutes who came on, Reg 3.4(h) forfeits), or as a starting point for an analysis in another language.

## Rebuild after changing a rule

```bash
bun run test           # the regulation's Figure 1 table must still pass
bun run snapshot --offline   # recalculate public/data from the archive; no CMS requests
bun run verify
git diff public/data   # the verdicts that changed
```

Rules are data: the thresholds and excluded competitions are `DEFAULT_RULES` in `packages/usa-club-rugby-data/src/rules.ts`, and every function takes the rules it applies, so a different season's rules can be tried without touching the code.

## Locked Seasons

Each Locked Season from 2022-23 is published under its own regulations; see "Locked Seasons" in [snapshots.md](snapshots.md) and ADR 006. To recount one, read it with `readSeason(archiveDir, season)` (from `/node`) and pass it to `buildLockedSeason`, which uses `rulesForSeason(season)` unless given other rules.

## Rebuild from scratch

```bash
bun run snapshot --full-history   # reads the CMS: thousands of requests at about 4 a second
```

The CMS only serves current records, so a fresh pull can differ from the committed archive wherever Rugby Xplorer has since corrected a lineup. That is the reason the raw archive is committed (docs/adr/002-raw-match-archive.md).

## Use the data from your own code

See [packages/usa-club-rugby-data/README.md](../packages/usa-club-rugby-data/README.md): a typed client for the published JSON, the pure rule functions, and a rate-limited live CMS client.
