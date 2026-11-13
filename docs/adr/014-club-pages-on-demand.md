# Club pages are generated on first request

**Supersedes "Page behaviour doesn't change yet" in [ADR 012](012-netlify-next-runtime.md) for the club page only.**

Issue #84. Every club page was generated at build time, one `getStaticProps` per club in the published index. ADR 012 moved the site onto Netlify's Next.js runtime so that a page could be rendered on demand; the club page is the first to be.

Decisions, so they are not "fixed" later:

- **The build generates no club pages.** `getStaticPaths` in `pages/club/[club]/index.tsx` returns no paths with `fallback: 'blocking'`. The first request for `/club/<key>/` runs `getStaticProps` in the route's function, waits for it, and returns the full page, verdicts and match table in the HTML (ADR 008's reason for static pages still holds). There is no loading state: `fallback: true` would serve an empty shell to visitors first.
- **Cached until the next deploy, never revalidated.** `getStaticProps` returns no `revalidate`. The data only changes with a deploy (ADR 011, ADR 012), and Netlify's runtime keys its cache to the deploy, so a page generated once is right for the life of the deploy and a new deploy starts empty. A time-based revalidate would only re-render the same data.
- **An unknown key is a 404.** `getStaticProps` returns `notFound` for a key that isn't in the published index, so a mistyped or retired club gets the site's 404 page rather than an error. Next caches that 404 for the deploy too.
- **The function carries only the files the page reads.** The page reads `index.json`, `fixtures.json` and `clubs/<key>.json` from `public/data` through `fsReader`. Next can't trace a path built at run time, so `next.config.ts` lists those files in `outputFileTracingIncludes` for `/club/[club]`, and excludes `public/data/seasons/**`, `seasons.json` and `players.json` ([ADR 013](013-published-player-index.md)), which only the build reads, in `outputFileTracingExcludes`. The Locked Season files are the bulk of `public/data` and the club page never opens them. (Since [ADR 019](019-faster-builds.md), no function carries `public/data`; it reads the files from the CDN.)
- **`BUILD_CLUBS` no longer scopes club pages** (ADR 015 removed it altogether). Every club opens in any build, quick or full, so `build:quick` and the PR screenshot build only use it to choose which players get a page. The screenshot job no longer adds a listed club to the build.
- **Player and stats pages stay at build time** (player pages moved in ADR 015). Moving them is a separate decision, with its own measurement of what the function would need to carry: a player page reads `players.json` and the files of each club the player is in (ADR 013), and the past seasons for their history.
