# Locked Seasons have real paths, generated on first request

**Supersedes "One page, chosen by query params" in [ADR 006](006-historical-eligibility.md).**

Issue #86. A Locked Season was one page, `/season/?season=<slug>&club=<key>`, that loaded the season's whole file (6–8 MB) in the browser and showed "Loading…" until it arrived. Its static HTML had no season or club in it, so a shared link had no title and no verdicts without JavaScript. With club pages generated on request (ADR 014), the reason for one page, keeping past seasons out of the build, no longer needs the browser to do the work.

Decisions, so they are not "fixed" later:

- **Three routes.** `/season/` lists the Locked Seasons published, built with the site from `seasons.json`. `/season/<slug>/` lists that season's clubs, and `/season/<slug>/<club-key>/` shows one club's final report. A player's Locked Season is a page under the player, `/player/<cms-id>/<slug>/` ([ADR 017](017-player-season-paths.md)).
- **The season and club pages are generated on first request**, as club pages are (ADR 014): `getStaticPaths` returns no paths with `fallback: 'blocking'`, no `revalidate`, and an unknown season or club key is the site's 404, cached for the deploy. The full page is in the HTML; there is no loading state and no season file fetched in the browser.
- **The page carries only what it shows.** The function reads the season's file from disk, and passes on only the season's clubs to the season page, and one club, its Match Participation and the fixtures in its divisions to the club page. Neither ships another club's file. In `next.config.ts` both routes include `seasons.json` and `seasons/*.json` and exclude the current season's files and the seasons' player indexes.
- **Old URLs are redirected by a proxy.** `proxy.ts` runs only on `/season/` with a `season` query and sends it to the new path with a 308; ADR 017 adds the player URLs. A redirect in `next.config.ts` can't drop the query that named the season: Next passes every query value on to the destination.
