# The eligibility rules and their decisions come from the Rocky Gorge tool

This project began as the eligibility tool on rockygorgerugby.com, which the league asked for at national level. The rules, the Match Record counting, and the decisions behind them were carried over unchanged, and are recorded here so they aren't "fixed" later. ADR 001 lists what changed for national coverage.

The rules are the 2026-27 Senior Club Regulations, for a club with any number of sides. For a side, count its matches and those of every side below it: that total must reach the two-match minimum (Reg 3.5.2(a)) and be at least the total for every side above (Reg 3.5(d)(ii)), and no side above may have reached four matches (Reg 3.5(d)(i)). The top side, and a one-side club, need two matches at any level (Reg 3.5.2(b), 3.4.2(e)). `eligibility-regulation.test.ts` holds all 20 rows of Figure 1 as the independent check; a change that breaks one is wrong.

Decisions:

- **Limit on any upper side**: four matches on any one side above forfeits, not four in total across them (Figure 1 has 3/4/1 eligible for divisions 1 and 2 only).
- **Two-match minimums are a deadline**: fixtures still to play before Super Regionals count towards them, shown as "on track". Remaining fixtures never affect the four-match limit or the comparison with upper sides. Future playoff fixtures with no teams count as one possible match per date for every side in that division. On track is experimental, since future playoffs aren't always entered.
- **CSV reports**: Played + Substitute only (Reserve and per-round codes don't count), taken as given. Registration dates are shown, not enforced. Rows with no USA ID are excluded; a player's rows for one team across competitions are summed.
- **Match Record join key**: the CMS player id, since the record has no USA ID.
- **Substitutes**: count only if a substitution event names them coming on. A different spelling is accepted only when the surname points to exactly one listed substitute. Where a side lists substitutes and none came on, the match is flagged as a gap rather than guessed at, as is a result with no lineup.
- **Coaches and forfeits**: neither counts, and a forfeit doesn't flag as a missing lineup.
- **Same name, two ids**: never merged, because combining two people could wrongly pass one. Both ids are shown.
- **Name Withheld**: a hidden profile, not a player, so it gets no row.
- **Divisions outside the NCS**: Men's IV and Women's III sides aren't assessed and don't affect a club's other sides.
- **Not covered**: registration, playing for another club (Reg 3.4(e)) and waivers aren't in the data.
- **Live pull**: the deployed page starts from the nightly data and pulls only the selected club's played fixtures that had no result in it. A partial pull counts as failed and falls back to the nightly data, saying so. Development uses only the nightly data.
