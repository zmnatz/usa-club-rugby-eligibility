# Player pages load grouped files, not one page per player

**Superseded by [ADR 008](008-static-player-pages.md).**

Player pages landed on 8 November 2026 (ade4d52) as one static page per player, about 9,400 of them, each with its own `_next/data` JSON. A deploy grew from a few hundred files to about 19,800 (409 MB). GitHub Pages took 75 to 100 seconds to process each one, up from about 30, and four deploys in two days stalled at `syncing_files` until the 10-minute limit. No two deploys overlapped and GitHub's status page was green. Retrying with the same files (#52) stalled too. GitHub publishes no file-count limit, so the count can't be proved to be the cause, but it was the only thing that changed when the stalls began, and processing time grows with it.

So there is one player page, `/player/?id=<cms-id>`, and the players' profiles are published in 256 files, `player-data/<bucket>.json`, keyed by a hash of the CMS id (`playerBucket` in `src/utils/playerBuckets.ts`). A deploy is back to a few hundred files.

**Correction, 10 November 2026: the file count was not the cause.** The first deploy of this change (about 1,250 files, 13 MB zipped) stalled in `syncing_files` for the full 10 minutes too. The deploys before it show the same artifact of about 19,800 files syncing in about 5 seconds on some runs (9 November 02:24, 10 November 10:33 and 11:46 UTC), taking 6.5 minutes on another, and stalling on others. Other repositories reported the same stalls from 6 November ([community discussion #212350](https://github.com/orgs/community/discussions/212350)), and GitHub's status page recorded Pages incidents on 4, 5–6 and 9 November, though none covers these stalls. They are intermittent on GitHub's side. The deploy workflow's retry now creates a deployment with a build version of its own (`docs/snapshots.md`). The grouped files stay: a deploy of a few hundred files is still quicker to build and upload, and the move below is planned anyway.

**This is temporary.** It works around GitHub Pages, a static host. The plan is to move the site to Netlify and render the player page on the server, so each player's page carries its verdict in its HTML again without a file per player in the deploy. When that happens, this ADR is superseded: the grouped files, `bun run players`, and the 404 redirect can go, and player URLs can go back to a path. Until then, the decisions below hold.

Decisions for now:

- **The files are worked out at build time** (`bun run players`, which `dev` and `build` run first) from `public/data`, by the same published client the pages used, with verdicts counted from the build's time as the club pages are. They are written to the gitignored `public/player-data/`, not `public/data/`: they are derived, not part of the nightly data or of `verify`, and not part of the package's published shapes.
- **A hash, not an id prefix.** CMS ids are base-62 strings, so a prefix would give 62 or 3,844 files. FNV-1a mod 256 spreads them evenly, about 37 players and 145 KB (15 KB gzipped) per file. Changing `PLAYER_BUCKETS` moves every player, which is harmless since the files are rebuilt each time.
- **The page loads its data in the browser,** as the Locked Season page does (ADR 006). Its static HTML is only the outline, so search engines and visitors without JavaScript don't see a player's verdict. Club pages, which carry every player's verdict, are still built statically.
- **Old links still work.** `/player/<cms-id>/` now reaches the site's 404 page, which sends it on to `/player/?id=<cms-id>` (`legacyPlayerId`). Search engines see the 404 status.
- **A PR's screenshot build** picks its sample player from the files and waits for the profile to load.
