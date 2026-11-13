import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { clubsWithoutFixtures } from '@zmnatz/usa-club-rugby-data';
import { ClubDirectory } from '@zmnatz/usa-club-rugby-html';
import { PageLink } from '@/components/Crumbs';
import { seasonClubPath, seasonPath, statsPath } from '@/utils/paths';
import { published, type PublishedClub, type PublishedSeason } from '@/utils/published';

interface HomeProps {
  clubs: PublishedClub[];
  season: string;
  generatedAt: string;
  pastSeasons: PublishedSeason[];
  /** Clubs of the last Locked Season with no games on record yet this season. */
  withoutGames: { season: PublishedSeason; clubs: PublishedClub[] } | null;
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const [index, pastSeasons] = await Promise.all([published.index(), published.seasons()]);
  // A club is listed from the fixtures this season, so one whose season starts later
  // isn't there yet: list it from the last season, marked as having no games yet.
  const last = pastSeasons[0];
  const withoutGames = last
    ? {
        season: last,
        clubs: clubsWithoutFixtures(
          { clubs: index.clubs, fixtures: await published.fixtures() },
          await published.season(last.slug),
        ),
      }
    : null;
  return {
    props: { clubs: index.clubs, season: index.season, generatedAt: index.generatedAt, pastSeasons, withoutGames },
  };
};

// A fixed locale and time zone, so the static HTML reads the same after hydration.
const formatDateTime = (dateTime: string) =>
  `${new Date(dateTime).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;

export default function HomePage({ clubs, season, generatedAt, pastSeasons, withoutGames }: HomeProps) {
  const waiting = withoutGames?.clubs.length ? withoutGames : null;
  return (
    <>
      <Head>
        <title>USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record."
        />
      </Head>
      <h1>NCS Eligibility</h1>
      <p className="lead">
        Pick a club to see which players are eligible for the National Championship Series,
        counted from the lineups and substitutions entered in Rugby Xplorer for every senior club
        league and local playoff match. Super Regionals, National Championships, 7s, friendlies,
        crossovers, Men&apos;s Division IV and Women&apos;s Division III don&apos;t count. Fixtures
        still to play before Super Regionals count towards the two-match minimums, shown as on
        track (experimental). <PageLink href="/methodology">How this report is worked out</PageLink>.
      </p>
      <p className="small">
        {season} season · {clubs.length} clubs with games on record
        {waiting && ` and ${waiting.clubs.length} without yet`} · data last changed {formatDateTime(generatedAt)}
      </p>
      {waiting && (
        <p className="small">
          Clubs marked &ldquo;No games on record yet&rdquo; have no fixtures in Rugby Xplorer this season, often
          because their season starts later. They are listed from the {waiting.season.season} season, and link to
          that season&apos;s report until their first fixture is entered.
        </p>
      )}
      {pastSeasons.length > 0 && (
        <p className="small">
          Past seasons:{' '}
          {pastSeasons.map(({ season: past, slug }, index) => (
            <span key={slug}>
              {index > 0 && ' · '}
              <PageLink href={seasonPath(slug)}>{past}</PageLink> (<PageLink href={statsPath(slug)}>stats</PageLink>)
            </span>
          ))}
          {' · '}
          <PageLink href={statsPath('')}>Stats across all past seasons</PageLink>
        </p>
      )}
      <p>
        <PageLink href="/csv" className="ec-btn">
          Check a Match Participation Report (CSV)
        </PageLink>
      </p>
      <ClubDirectory
        clubs={clubs}
        autoFocus
        withoutGames={
          waiting ? { clubs: waiting.clubs, href: (key) => seasonClubPath(waiting.season.slug, key) } : undefined
        }
      />
    </>
  );
}
