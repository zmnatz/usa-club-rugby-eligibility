# The nightly data publishes a player index

Issue #82. Reverses 4349402 (8 November 2026), which stopped publishing `players.json` so that each consumer worked out its own player index from the club files.

Working the index out means reading and calculating every club's verdicts, about 312 clubs, to answer one lookup. Once per static build that is acceptable (ADR 008), but a page generated on first request, which the Netlify runtime (ADR 012) allows, can't afford it.

Decisions, so they are not "fixed" later:

- **`players.json` is published beside the club files.** It is `PublishedPlayersFile`: the current season, and for each CMS id the player's name and the keys of the clubs whose record they appear in. Name Withheld profiles are left out, as everywhere else. It is calculated by `buildPlayerIndex` in `buildPublished`, under the run's rules and as of the archive's `pulledAt`, like every other published file, so `verify` checks it. It carries no `generatedAt`, as `fixtures.json` doesn't.
- **Additive.** No existing file changes shape. It is still a change to the published JSON, so the package's next release is a new minor version.
- **The default lookup reads it.** `published.playerIndex()` and `published.player(id)` with no options read `players.json` and then only the clubs it names. Data published before the file existed has none, so the client falls back to working it out.
- **Custom options still work it out.** A caller passing `rules` or `now` gets an index calculated under those options from every club's file, since a different rule could change who has a verdict where.
- **Locked Seasons get no index file** (superseded by ADR 015, which publishes one beside each). Each is one published file already, so the client works its index out from that file, as before.
