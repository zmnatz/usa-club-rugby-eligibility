import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { PlayerClubEntry, PlayerProfile, PlayerSeasonProfile } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { EligibilityStatusChip, PlayerDetailBody } from '@zmnatz/usa-club-rugby-html';
import { clubPath, openSeason, playerSeasonPath, seasonClubPath } from '@/utils/paths';
import { listPlayerIds, published } from '@/utils/published';

/** Every player in the nightly data. Players can change clubs, so a player's page
 *  is under no club. Name Withheld players have no page. */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await listPlayerIds()).map((player) => ({ params: { player } })),
  fallback: false,
});

/** One season of a player's record: `current` is the season in progress, whose
 *  fixtures are still being played. */
interface SeasonView {
  season: string;
  slug: string;
  clubs: PlayerClubEntry[];
  current: boolean;
}

interface PlayerPageProps {
  id: string;
  name: string;
  seasons: SeasonView[];
}

export const getStaticProps: GetStaticProps<PlayerPageProps> = async ({ params }) => {
  const id = typeof params?.player === 'string' ? params.player : null;
  if (!id) return { notFound: true };
  const [current, past, index] = await Promise.all([published.player(id), published.playerSeasons(id), published.index()]);
  const seasons: SeasonView[] = [
    ...(current ? [{ season: index.season, slug: 'current', clubs: current.clubs, current: true }] : []),
    ...past.map(({ season, slug, clubs }) => ({ season, slug, clubs, current: false })),
  ];
  const name = current?.name ?? past[0]?.name;
  return name && seasons.length > 0 ? { props: { id, name, seasons } } : { notFound: true };
};

/** A player's verdict in one club. */
function PlayerInClub({ entry, season }: { entry: PlayerClubEntry; season: SeasonView }) {
  return (
    <section>
      <div className="ec-row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          <PageLink href={season.current ? clubPath(entry.clubKey) : seasonClubPath(season.slug, entry.clubKey)}>{entry.clubName}</PageLink>
          {entry.sideLabel && ` · ${entry.sideLabel}`}
        </h2>
        <EligibilityStatusChip player={entry.player} />
        {entry.showCmsId && <span className="ec-muted ec-small">CMS ID {entry.player.playerId}</span>}
      </div>
      <div className="ec-card">
        <PlayerDetailBody player={entry.player} source="record" ownLabel={entry.sideLabel} fixtures={entry.fixtures} />
      </div>
    </section>
  );
}

/** One player's verdict and the matches behind it, on a page of its own so it can
 *  be linked to, with a tab for each season they're in the record of. A player can have
 *  played for several clubs in a season, so a tab has a section for each: eligibility
 *  is worked out within a club. Built from the nightly data. */
export default function PlayerPage({ id, name, seasons }: PlayerPageProps) {
  // The open tab is in the URL, so Back steps between seasons and a link shares one.
  const { query } = useRouter();
  const selected = openSeason(query);
  const season = seasons.find((candidate) => candidate.slug === selected) ?? seasons[0];
  const panelProps = seasons.length > 1 ? { role: 'tabpanel', 'aria-labelledby': `season-tab-${season.slug}` } : {};
  return (
    <>
      <Head>
        <title>{`${name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS eligibility for ${name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: name }]} />
      <h1>{name}</h1>
      {seasons.length > 1 && (
        <div className="ec-tabs" role="tablist" aria-label="Season">
          {seasons.map((item) => (
            <Link
              key={item.slug}
              href={playerSeasonPath(id, item.slug)}
              shallow
              scroll={false}
              role="tab"
              id={`season-tab-${item.slug}`}
              aria-selected={item.slug === season.slug}
              aria-controls="season-panel"
              className="ec-tab"
            >
              {item.season}
            </Link>
          ))}
        </div>
      )}
      <div id="season-panel" {...panelProps}>
        {!season.current && (
          <p className="small">
            Final verdicts under the {season.season} regulations. <PageLink href="/methodology">How this is worked out</PageLink>.
          </p>
        )}
        {season.clubs.length > 1 && (
          <p className="small">
            Listed {season.clubs.length} times in the record, for different clubs or sides. Each is assessed on its own.
          </p>
        )}
        <div className="ec-stack" style={{ gap: 32 }}>
          {season.clubs.map((entry) => (
            <PlayerInClub key={`${season.slug}-${entry.clubKey}-${entry.player.teamName}`} entry={entry} season={season} />
          ))}
        </div>
      </div>
    </>
  );
}
