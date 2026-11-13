# The all-seasons stats page is rendered on request, cached by the CDN until the next deploy

Issue #94. `/stats/` puts every Locked Season's stats side by side, so it reads every season's file, most of `public/data`, and worked them out at build time: the slowest page in the build once the season stats pages moved to first request (ADR 016). It is a fixed path, so the way those pages work, `getStaticPaths` with no paths and `fallback: 'blocking'`, doesn't apply: Next always prerenders a fixed path that has `getStaticProps`.

Decisions, so they are not "fixed" later:

- **`getServerSideProps`, with a CDN cache header.** The page sets `Cache-Control: public, max-age=0, s-maxage=31536000` (`UNTIL_NEXT_DEPLOY`). Netlify's CDN keeps the response and a deploy clears it, so the first request after a deploy renders the page and the rest are served from the cache, as a page generated on first request is (ADR 014). The browser doesn't cache it (`max-age=0`), so a visitor never sees the last deploy's numbers. There is no `stale-while-revalidate`: the data only changes with a deploy.
- **Not an optional catch-all.** Folding `/stats/` into `/stats/[[...season]]` would get it `fallback: 'blocking'`, but would make two different pages one route. The header is the smaller change.
- **The function carries only the Locked Season files**, with the same includes and excludes as the season pages (ADR 016).
- **`next start` doesn't cache it.** Run locally, every request renders the page; only the CDN keeps it.
- **Other fixed-path pages stay at build time.** `/` and `/season/` read the index and `seasons.json`, and cost the build almost nothing. `/unreported/` counts days from when it is built, so it is a separate decision.
