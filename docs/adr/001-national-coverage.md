# Every senior club, from the council, union and club feeds

The tool covers every senior club in Rugby Xplorer rather than one league. The [Senior Club Council](https://xplorer.rugby/senior-club-council/fixtures-results?team=All&comp=All&season=All&tab=Fixtures) (CMS id 90001, type `council`) is the root for club teams, but in November 2026 its feed was missing 61 of 166 current-season Capital fixtures, and the union feeds held 404 fixtures it didn't. So the nightly job reads three kinds of feed and merges them by fixture id:

1. The council's feed.
2. Every geographical union's feed (`config/sources.yml`; ids 90067 to 90084 with fixtures, found by scanning that range).
3. Every playing club's feed, keeping only competitions that appear in the first two, since a club's feed also lists college, 7s and out-of-union matches.

Feeds carry only a placeholder crest, so club ids can't come from them. Match records do carry each side's club crest (`/ru/team/<id>.png`), and the job fetches every result's record anyway, so clubs are found from those, saved in the archive manifest, and their feeds read. A club feed can add results whose records name more clubs, so this repeats until no new club appears (at most five rounds).

Decisions, so they are not "fixed" later:

- **Team names**: the division is read from the end of the name in the forms the unions use: `MD1`, `WD2`, `W+D3`, `D2 1st XV`, `MD3 2nd`, `M D2 1st XVs`, `Womens D2 1st XV`. A name with no division (`NYAC ARP`, `... Festival`, `... Social`, `... W+NCP`) can't be ranked and isn't assessed. About 10% of names were like that in November 2026.
- **American Rugby Premiership**: out of scope. ARP sides aren't assessed and their matches don't count towards a club's other sides. Add them only if someone asks.
- **Two sides at one level**: the 1st XV is treated as the upper side.
- **Approved 3.4.3 Matches**: a union listing approved Recognized Competitive Matches as a competition is counted, since Reg 3.4.3 counts them once approved.
- **Socials, festivals and 7s qualifier rosters**: excluded by competition name, added to the list carried from Rocky Gorge.
- **Club links**: a match report loads under any entity's path, so match links use the council's. Club pages aren't looked up.
- **Clubs in the picker**: the clubs in the published index, which is calculated from the same fixtures as the club files, so a listed club always has a file.
- **Rate limit**: the CMS is behind Stellate, which allows each IP a budget of 500 requests refilling at about 4 a second, and counts blocked requests against it. More parallel requests don't go faster than that. Every response reports the budget left, so all requests share one gate in `src/utils/api.ts` that pauses when it runs low and waits out a 429's `Retry-After` without using up a retry.
- **Batched requests**: the CMS answers many queries in one request, each under its own alias, and that counts once against the limit. Match records go 100 to a request, the size Rocky Gorge measured (uncached batches of 25 to 150 worked in 2 to 31 seconds; 1,059 at once failed with a 500). Feed pages go 20 to a request, about the same size of answer. A rejected batch is asked again one at a time, so one bad entry can't fail its batch.
