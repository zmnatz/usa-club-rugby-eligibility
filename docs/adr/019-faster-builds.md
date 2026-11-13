# Builds reuse the Locked Seasons, and functions read the published data from the CDN

**Supersedes what ADRs 014, 015, 016 and 018 say about the files a page's function carries.**

Once the pages moved to first request (ADRs 014 to 018), `next build` took about 2 s, and the build was mostly two things. Calculating `public/data` took about 16 s, 13.5 s of it the four Locked Seasons, whose archive never changes. And Netlify deployed one function for the whole server (30 MB), carrying all of `public/data` (41 MB of JSON before compression) beside Next.

Decisions, so they are not "fixed" later:

- **The data build keeps the Locked Seasons between builds.** `usa-club-rugby-data build --cache <dir>` (`cacheDir` in `runSnapshot`) keeps each season's two published files under a key made from the season's archive files and a hash of the package's own built code, and reuses them when both match. A change to the rules or the calculation changes the code hash, so no rule change is ever served from the cache. A season whose key isn't used is pruned, so the cache holds one build. `verify` and `publishFromArchive` never use it, so `verify` still recalculates everything from the archive.
- **The cache lives in `.next/cache/locked-seasons`.** Netlify's Next.js runtime restores and saves `.next/cache` around every build, so no plugin is needed, and `next build` leaves that directory alone. A build with its cache cleared recalculates every season and is no slower than before.
- **A deployed function reads the published data over HTTP, from its own deploy.** At build time `next.config.ts` records the deploy's permalink (`DEPLOY_URL`, which Netlify sets) as `PUBLISHED_DATA_URL`, and `src/utils/published.ts` reads with `httpReader` from `<permalink>/data` when `public/data` isn't on disk. The permalink serves that deploy's files and no other's, so a function never mixes data from two deploys. The build, `next start`, `next dev` and CI read the disk as before.
- **No route carries `public/data`.** `outputFileTracingExcludes` drops it from every route, and the per-route includes are gone. The function now holds only Next's server and the site's code.
- **The first request for a page reads its files over the network.** A Locked Season's file is 6 to 9 MB; the CDN serves it compressed, and the client keeps every file it reads for the life of the function instance. This replaces a disk read, and only on a page's first request after a deploy.
- **A commit that can't change the site isn't built.** `ignore` in `netlify.toml` skips a build when nothing has changed since the last one but the docs, the tests and CI, Markdown, or the MUI package, which the site doesn't use (ADR 009). A build without cache, where Netlify gives the same commit for both, always builds, and so does any error from `git`.
- **The data step builds only the packages the site uses** (`bun run lib:site`: the data and HTML packages). `bun run lib` still builds all three for `typecheck` and `test`.
