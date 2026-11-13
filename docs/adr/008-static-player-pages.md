# Player pages are static pages again

**Supersedes [ADR 007](007-grouped-player-data.md). Pages are now generated on first request rather than at build time (ADR 015).**

ADR 007 grouped the player data into 256 files, loaded in the browser, because GitHub Pages deploys began stalling at `syncing_files` when one static page per player (about 19,800 files) landed. The deploys kept stalling after the deploy shrank back to a few hundred files, so the file count wasn't the cause, and the workaround cost something real: a player's verdict wasn't in the page's HTML, so search engines and visitors without JavaScript couldn't see it.

The site is moving to Netlify (`netlify.toml`), so each player again has a page of their own at `/player/<cms-id>/`, built from `public/data` at build time like the club pages. ADR 007 planned to render the player page on the server; a static page gives the same HTML with nothing to run, so there is no server.

- **Gone:** `bun run players`, the gitignored `public/player-data/`, `src/utils/playerBuckets.ts` and the `/player/?id=` page.
- **Kept from ADR 007:** the package's `PublishedReader` and `fsReader`, which the build reads `public/data` through, and `published.player()`, which works out every club's verdicts once per build process. (Since [ADR 013](013-published-player-index.md) it finds the player's clubs in the published `players.json` and reads only those.)
- **Links from ADR 007 still work.** `/player/?id=<cms-id>` reaches the site's 404 page, which sends it on to `/player/<cms-id>/` (`queryPlayerId`).
- **GitHub Pages keeps deploying the full site** until the move to Netlify is finished, and may keep stalling as it did before.
