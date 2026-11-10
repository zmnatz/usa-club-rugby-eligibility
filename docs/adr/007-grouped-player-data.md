# Player pages load grouped files, not one page per player

**Superseded by [ADR 008](008-static-player-pages.md).**

Player pages landed on 8 November 2026 (ade4d52) as one static page per player, about 9,400 of them, each with its own `_next/data` JSON. A deploy grew from a few hundred files to about 19,800 (409 MB). GitHub Pages took 75 to 100 seconds to process each one, up from about 30, and four deploys in two days stalled at `syncing_files` until the 10-minute limit. No two deploys overlapped and GitHub's status page was green. Retrying with the same files (#52) stalled too. GitHub publishes no file-count limit, so the count can't be proved to be the cause, but it was the only thing that changed when the stalls began, and processing time grows with it.

So there is one player page, `/player/?id=<cms-id>`, and the players' profiles are published in 256 files, `player-data/<bucket>.json`, keyed by a hash of the CMS id (`playerBucket` in `src/utils/playerBuckets.ts`). A deploy is back to a few hundred files.

**This is temporary.** It works around GitHub Pages, a static host. The plan is to move the site to Netlify and render the player page on the server, so each player's page carries its verdict in its HTML again without a file per player in the deploy. When that happens, this ADR is superseded: the grouped files, `bun run players`, and the 404 redirect can go, and player URLs can go back to a path. Until then, the decisions below hold.

Decisions for now:

- **The files are worked out at build time** (`bun run players`, which `dev` and `build` run first) from `public/data`, by the same published client the pages used, with verdicts counted from the build's time as the club pages are. They are written to the gitignored `public/player-data/`, not `public/data/`: they are derived, not part of the nightly data or of `verify`, and not part of the package's published shapes.
- **A hash, not an id prefix.** CMS ids are base-62 strings, so a prefix would give 62 or 3,844 files. FNV-1a mod 256 spreads them evenly, about 37 players and 145 KB (15 KB gzipped) per file. Changing `PLAYER_BUCKETS` moves every player, which is harmless since the files are rebuilt each time.
- **The page loads its data in the browser,** as the Locked Season page does (ADR 006). Its static HTML is only the outline, so search engines and visitors without JavaScript don't see a player's verdict. Club pages, which carry every player's verdict, are still built statically.
- **Old links still work.** `/player/<cms-id>/` now reaches the site's 404 page, which sends it on to `/player/?id=<cms-id>` (`legacyPlayerId`). Search engines see the 404 status.
- **A PR's screenshot build** picks its sample player from the files and waits for the profile to load.
