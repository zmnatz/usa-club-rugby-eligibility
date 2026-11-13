import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { ClubDirectory } from '@zmnatz/usa-club-rugby-html';
import { PageLink } from '@/components/Crumbs';
import { seasonPath, statsPath } from '@/utils/paths';
import { published, type PublishedClub, type PublishedSeason } from '@/utils/published';

interface HomeProps {
  clubs: PublishedClub[];
  season: string;
  generatedAt: string;
  pastSeasons: PublishedSeason[];
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const [index, pastSeasons] = await Promise.all([published.index(), published.seasons()]);
  return {
    props: { clubs: index.clubs, season: index.season, generatedAt: index.generatedAt, pastSeasons },
  };
};

// A fixed locale and time zone, so the static HTML reads the same after hydration.
const formatDateTime = (dateTime: string) =>
  `${new Date(dateTime).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;

export default function HomePage({ clubs, season, generatedAt, pastSeasons }: HomeProps) {
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
        {season} season · {clubs.length} clubs · data last changed {formatDateTime(generatedAt)}
      </p>
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
      <ClubDirectory clubs={clubs} autoFocus />
    </>
  );
}
