# A player's Locked Seasons have paths under the player

**Supersedes "One player dialog, in every season, opened by the URL" in [ADR 010](010-react-on-every-page.md).**

Issue #87. A name in a club report opened the player's detail in a dialog over the report, from `?player=<cms-id>` on the report's URL, and the player's own page chose its season tab by `?season=<slug>`. ADR 010 chose a query over a path because a path would have needed a static page per club and player. With club, season and player pages all generated on request (ADRs 014, 015, 016), that cost is gone, and a player's detail can be a page whose HTML has the verdict in it.

Decisions, so they are not "fixed" later:

- **A player's pages are keyed by the player, with the season after.** `/player/<cms-id>/` shows this season; for a player who isn't in this season's record it redirects (not permanently) to the newest Locked Season they're in, so each season has one URL. `/player/<cms-id>/<season-slug>/` shows one Locked Season. Season and club pages stay under the season (`/season/<slug>/<club-key>/`, ADR 016); a player isn't under a club, since they can move between clubs, even within a season.
- **No dialog.** A name in this season's club report links to `/player/<cms-id>/`, and in a Locked Season's to `/player/<cms-id>/<season-slug>/`. `ClubEligibilityReport` takes no `playerId` or `onClose`, and the HTML package's dialog and its `.ec-dialog` styles are gone: a breaking change to its exports.
- **Each season tab is a page.** The tabs link to those paths, and each page carries only the season it shows, with the player's verdict in each of their clubs and, for a player who moved, their games for the other clubs and the Waiver Required badge the dialog showed. A season the player isn't in the record of is a 404. When they were in one club that season, the breadcrumb leads back to its report.
- **Old URLs are redirected by the proxy.** `proxy.ts`, with `legacyRedirect` in `src/utils/paths.ts`, sends `/club/<key>/?player=`, `/season/<slug>/<key>/?player=`, `/player/<cms-id>/?season=` and `/player/?id=<cms-id>` (ADR 007) to the new paths with a 308. The 404 page's inline redirect script and `queryPlayerId` are gone, superseding what ADRs 008, 009 and 010 say about them.
