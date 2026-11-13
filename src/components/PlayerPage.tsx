import Head from 'next/head';
import { EligibilityStatusChip, PlayerDetailBody, Tabs, WaiverChip } from '@zmnatz/usa-club-rugby-html';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { clubPath, playerPath, playerSeasonPath, seasonClubPath, seasonPath, seasonsPath } from '@/utils/paths';
import type { PlayerPageProps, PlayerSeasonEntry, PlayerSeasonTab } from '@/utils/playerPage';

// A null slug is the current season.
const tabKey = ({ slug }: PlayerSeasonTab) => slug ?? 'current';
const clubHref = (slug: string | null, clubKey: string) => (slug ? seasonClubPath(slug, clubKey) : clubPath(clubKey));
const playerHref = (id: string, slug: string | null) => (slug ? playerSeasonPath(id, slug) : playerPath(id));

/** A player's verdict in one club. */
function PlayerInClub({ entry, slug }: { entry: PlayerSeasonEntry; slug: string | null }) {
  return (
    <section>
      <div className="ec-row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          <PageLink href={clubHref(slug, entry.clubKey)}>{entry.clubName}</PageLink>
          {entry.sideLabel && ` · ${entry.sideLabel}`}
        </h2>
        <EligibilityStatusChip player={entry.player} />
        {entry.otherClubs.length > 0 && <WaiverChip />}
        {entry.showCmsId && <span className="ec-muted ec-small">CMS ID {entry.player.playerId}</span>}
      </div>
      <div className="ec-card">
        <PlayerDetailBody
          player={entry.player}
          source="record"
          ownLabel={entry.sideLabel}
          fixtures={entry.fixtures}
          otherClubs={entry.otherClubs}
        />
      </div>
    </section>
  );
}

/** One player's verdict and the matches behind it, on a page of its own so it can be
 *  linked to, with a tab for each season they're in the record of. Each tab is a page:
 *  `/player/<cms-id>/` for this season, `/player/<cms-id>/<season-slug>/` for a Locked
 *  Season (ADR 017). A player can have played for several clubs in a season, so a season
 *  has a section for each: eligibility is worked out within a club. */
export function PlayerPage({ id, name, tabs, shown }: PlayerPageProps) {
  const { season, slug, clubs } = shown;
  const locked = slug !== null;
  const [club, ...others] = clubs;
  const oneClub = club && others.every((entry) => entry.clubKey === club.clubKey) ? club : null;
  return (
    <>
      <Head>
        <title>{`${name}${locked ? ` ${season}` : ''} · USA Club Rugby Eligibility`}</title>
        <meta name="description" content={`NCS eligibility for ${name}, worked out from the Rugby Xplorer match record.`} />
      </Head>
      <Crumbs
        trail={[
          { label: 'All clubs', href: '/' },
          ...(locked
            ? [
                { label: 'Past seasons', href: seasonsPath },
                { label: season, href: seasonPath(slug) },
              ]
            : []),
          // Back to the club's report, when they were in only one club that season.
          ...(oneClub ? [{ label: oneClub.clubName, href: clubHref(slug, oneClub.clubKey) }] : []),
          { label: name },
        ]}
      />
      <h1>{name}</h1>
      <Tabs
        label="Season"
        selected={tabKey(shown)}
        tabs={tabs.map((tab) => ({
          key: tabKey(tab),
          label: tab.season,
          href: playerHref(id, tab.slug),
        }))}
      >
        {locked && (
          <p className="small">
            Final verdicts under the {season} regulations. <PageLink href="/methodology">How this is worked out</PageLink>.
          </p>
        )}
        {clubs.length > 1 && (
          <p className="small">
            Listed {clubs.length} times in the record, for different clubs or sides. Each is assessed on its own.
          </p>
        )}
        <div className="ec-stack" style={{ gap: 32 }}>
          {clubs.map((entry) => (
            <PlayerInClub key={`${tabKey(shown)}-${entry.clubKey}-${entry.player.teamName}`} entry={entry} slug={slug} />
          ))}
        </div>
      </Tabs>
    </>
  );
}
