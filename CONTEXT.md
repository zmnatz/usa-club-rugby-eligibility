# Glossary

Eligibility rules follow the current USA Club Rugby Senior Club Regulations (§3.4.2, §3.5).

**Senior Club Council**:
The Rugby Xplorer entity for senior club rugby (`senior-club-council`, CMS id 90001, type `council`). The root fixture list for club teams, though not a complete one.

**Feed**:
One entity's fixture list from the CMS: the council's, a geographical union's, or a club's. No one feed is complete, so the nightly job merges all three kinds.
_Avoid_: schedule, calendar

**Club**:
The teams sharing a name before their division, with men's and women's sides as separate clubs ("NOVA" and "NOVA Women").

**Side**:
One of a club's teams, ranked by the division at the end of its name ("MD1", "W+D3", "D2 1st XV"). A club's 1st XV ranks above its 2nd XV at the same level.

**Upper Side**:
Any of a club's sides in a higher division than the one being assessed. A lower side's eligibility compares its matches, plus those of every side below it, with the total for all upper sides.
_Avoid_: senior team

**Match Participation Report**:
The Rugby Xplorer CSV export, one row per player per team and competition, carrying `Appearances` / `Played` / `Reserve` / `Substitute` totals and per-round attendance codes. The official count.
_Avoid_: roster dump, match report

**Match Record**:
The lineups and substitutions the CMS holds for each result. It carries no USA IDs or registration data, and it can have gaps: a side with no lineup, or with no substitutions entered.

**Match Participation**:
The number of NCS Qualifying Matches a player entered as a starter or substitute, from the `Played` and `Substitute` columns of a Match Participation Report or counted from the Match Record. The value every eligibility threshold checks.
_Avoid_: appearances, games played

**NCS Qualifying Match**:
A league or local-playoff match that counts toward a player's Match Participation. Super Regionals, National Championships, 7s, friendlies, crossovers, socials, festivals, and Men's D4 and Women's D3 matches don't count.

**On Track**:
A player who hasn't yet met a two-match minimum but can still reach it, because enough of the side's possible matches remain before Super Regionals. Counted as eligible and shown separately.
_Avoid_: provisionally eligible, pending

**One-Side Club**:
A club with only one side in the fixture lists, assessed under the two-match minimum.

**Name Withheld**:
How the CMS shows a player whose profile isn't public. A hidden profile, not a player: it gets no player record or eligibility row.

**Archive**:
The raw match records and fixture lists the nightly job saves in `archive/`, committed but not published. Everything published is calculated from it.
_Avoid_: cache, snapshot (the snapshot is the published data)

**Locked Season**:
A season before the current one. Its archive is read once more as the next season begins and never again, unless the fields requested change or a `--full-history` run asks.
_Avoid_: archived season, old data

**National Championship Series (NCS)**:
USA Rugby's postseason competition for Men's Divisions I, II and III and Women's Divisions I and II.
