# Locked Seasons are published under the regulations of their own year

Issue 46 asks for final verdicts in past seasons. Rugby Xplorer holds senior club fixtures from 2022-23 (the council's feed ends around August 2022), so those are the seasons covered. The regulations changed during that time and the source is USA Club Rugby's record of divisional guideline changes, 2010 to the present.

| Season | Upper-side limit | Upper sides for a lower side | Half the matches with the upper sides |
| --- | --- | --- | --- |
| 2022-23 | 66% of the schedule | Each judged alone | Loses the lower side |
| 2023-24, 2024-25 | 66% of the schedule | Added together | Loses the lower side |
| 2025-26, 2026-27 | Four matches on any one side | Each judged alone | Keeps it (lower must be at least equal) |

All of them keep the two-match minimum at or below the side, and two at any level for the top side.

`rulesForSeason` returns the rules for a season; `eligibility-history.test.ts` holds each season's Figure 1. A Locked Season has no On Track or Caution: nothing is left to play.

Decisions, so they aren't "fixed" later:

- **The 66% trigger is rounded to the nearest match**, which reproduces Figure 1 except that 2023-24 and 2024-25 print 4 for a five-match schedule, kept as an exception. 2022-23 refers to a Figure 1 the record doesn't reprint, so it uses 2021-22's table.
- **"Schedule" is the final fixture list.** The regulations fix the mark from the league schedule as of the first weekend, which the CMS doesn't keep. A side's schedule here is every Qualifying fixture in the Archive, played or not, except postponed ones. Waivers aren't in the data either.
- **The 50% comparison adds a player's upper sides together** in every season, though 2022-23 to 2024-25 say "the Upper Division side", singular. Only that total can be compared with "the total number of NCS Qualifying Matches played by a player".
- **2022-23's printed example is not followed.** It keeps a Division 1 and 3 example ("at least 3 Division I Qualifying Matches") that matches the 2019-20 rule, not its own 66% text, so the text decides.
- **The shorter schedule decides.** A side with two or more upper sides is measured against whichever has fewer Qualifying fixtures, as the regulations say. A side with no fixtures in the record sets no limit.
- **Sides come from competition names too** (`historicalSides.ts`). Most team names before 2025-26 have no division ("White Plains M"), so a team takes the division named by the competitions of most of its fixtures, and its club from what's left of its name. The current season still reads names alone (`parseTeamSide`), so its published data doesn't change.
- **A team alone at its club needs no division.** With no division in its name or competitions it is a one-side club, labelled "Senior", assessed only on the two-match minimum. Names of championship rounds and one-off entries (`NOT_A_SIDE`: Championship, Premiership, 18+, ARP, 7s, 10s and so on) aren't sides, so they stay unmatched. Other second teams with a name of their own ("... Developmental") can't be told from a separate club, so they are assessed alone.
- **A 2nd XV or B side with no division ranks one division below its club's lowest placed side** ("Pigs 2nd XV" below "Pigs Men's D2 Senior" is D3), and a 3rd XV or C side two below. With no side of its club placed it is taken as Division 3, unless its club's only other team has no division either ("Quake 1st XV", "Quake 2nd XV"): then the two are ranked in that order and labelled "1st XV" and "2nd XV". A division in its name or competitions wins over this, and a side that would fall below the NCS isn't assessed.
- **Age tags mark a senior team.** "18+", "18-99" and "(18-99)" ("Atlanta Bucks 18+" in the Georgia matrix) are dropped from the name like "Senior".
- **Rocky Mountain tiers are divisions.** 2022-23 team names end in "RMR Premiership" or "RMR Championship"; the same clubs appear later at D2 (Boulder, Haggis) and D3 (Denver Barbarians B), so Premiership is D2 and Championship D3. The next season's RMR men's top league was a "D1/D2 Hybrid" and 2024-25 had no men's D1, so D1 is possible for Premiership; within a club only the order matters to the verdicts, which is the same either way.
- **One club under several spellings.** Club names are compared ignoring case, punctuation and spacing ("Philadelphia-Whitemarsh", "Philadelphia Whitemarsh"), and a name may give its XV as a number ("San Antonio 2 M"), a letter ("NYAC Mens A", "(B)", " - B Side"), or its division before its gender ("D2M"). A name giving two divisions ("D1/D2") is taken at the lower one, with a note. "2nd XV" is shown only where two sides share a division. Clubs with different names that share players (Chicago Griffins and Westside Condors) can't be told from separate clubs, so their players are marked Waiver Required.
- **June and July don't count, in any season** (`excludedMonths` in `DEFAULT_RULES`). That is the 7s season, and many summer 7s competitions don't say "7s". A team only seen then drops out. A team with other matches keeps them: 15s sides enter summer 7s under their own names ("Detroit Tradesmen D1", 10 matches and 3 in summer 7s in 2022-23), so dropping every team seen in summer would drop real sides. Alaska's league plays in summer, so its June and July matches are lost too.
- **Left out on purpose:** American Rugby Premiership, 7s and 10s sides whatever competition they're in, one-fixture playoff placeholders ("Atlanta WD2 Championship" in "CGRU Championships Beta"), 7s, 10s, selects and all-star sides. Divisions aren't guessed by matching club names between seasons, since names repeat across the country (Columbus, Georgia and Columbus, Ohio). For the same reason a team with no division joins a namesake club only if they play a club in common; otherwise it is a club of its own.
- **Every guess is noted on the club's page.** A division chosen from several in a team's competitions, a Rocky Mountain tier, a second side placed below its club, a 1st and 2nd XV ranked by name, a one-side club with no division, and a club kept apart from a namesake each add a note naming the team (`HistoricalClub.notes`).
- **A player who played for more than one club** is shown only at the club of their last counted match, marked "Waiver Required", with their games for the other clubs listed in their detail (`assignTransfers`). Each club counts only its own matches, so those games don't count toward the verdict. The guideline record has no rules on changing clubs, so whether a move was allowed (Reg 3.4(e)) isn't checked; the badge says it needs checking. The current season is unchanged.
- **A wrong ranking is worse than a missing club.** A club with two names at one division ("Bay Men", "Bay Men Senior") could be one team renamed, and ranking one above the other would judge a player against their own side, so the club is left out. A team with no division that looks like a published club's is named on that club's page, because its absence can make lower-side players look eligible.
- **Unplaced Teams are listed by name** at the foot of the season's page, as a record. Many are championship rounds and one-off entries rather than sides, so they aren't presented as a problem.
- **One page, chosen by query params.** `/season?season=<slug>&club=<key>` loads the season's file in the browser, so past seasons add no static pages to any build. A first visit is a little slower, needs JavaScript and has no club-specific title in its static HTML. The player detail opens in the report's dialog.
- **Each Locked Season is one file**, `public/data/seasons/<slug>.json`, as in the Archive, where each has a fixtures and a matches file. It has no timestamp, so it doesn't change on later nights.
- **Not covered:** WPL and RSL participation limits (earlier seasons than the record), the 2019-20 and earlier division tables (no match records), and the rule against moving between 28-player rosters during the NCS.

Assumptions, each open to correction by someone who knows that season's regulations in full. The source covers divisional eligibility only, so anything else is carried from today's regulations (ADR 000):

- **What counts as a match** is today's in every season: Played plus Substitute, Reg 3.4(h) for forfeits, and the current list of excluded competitions.
- **The NCS divisions** are Men's I to III and Women's I and II in every season, so a Men's IV or Women's III side isn't assessed.
- **2025-26 uses the 2026-27 regulations**, because the source lists the two under one heading.
- **The schedule includes local playoffs**, as the count of Qualifying fixtures does, though the text says "league schedule". It can only be approximated either way.
- **A schedule below five matches** isn't in any Figure 1, so the same rounding applies to it.
- **A club name** is what's left of a team name without its trailing gender, division, XV and words such as "Senior" or "Club". Differently spelled names are different clubs, and a team whose name and competition don't say is taken as men's.
- **A letter side** ("B Side") ranks as that XV at its division, as "2nd XV" does.
- **"No warnings" means no player status warnings.** On Track and Caution are gone. The notices about gaps in the record and about Unplaced Teams stay, because they say the data behind a final verdict may be incomplete.
- **Older records are taken as entered.** Lineups and substitutions may be thinner in older seasons, which shows as gaps or low counts.
