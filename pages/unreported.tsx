import type { GetStaticProps } from 'next';
import Head from 'next/head';
import {
  FULL_SIDE,
  formatDate,
  rulesForSeason,
  UNREPORTED_LEEWAY_DAYS,
  type UnreportedGame,
  unreportedGames,
} from '@zmnatz/usa-club-rugby-data';
import { UnreportedGames } from '@zmnatz/usa-club-rugby-html';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { published } from '@/utils/published';

interface UnreportedProps {
  games: UnreportedGame[];
  season: string;
  builtAt: string;
}

export const getStaticProps: GetStaticProps<UnreportedProps> = async () => {
  const [index, fixtures] = await Promise.all([published.index(), published.fixtures()]);
  const files = await Promise.all(index.clubs.map((club) => published.club(club.key)));
  // Counted from the build, which runs each night, so a game is listed the day its leeway ends.
  const now = new Date();
  const games = unreportedGames({
    fixtures,
    gaps: files.flatMap(({ snapshot }) => snapshot.gaps),
    clubs: index.clubs,
    rules: rulesForSeason(index.season),
    now,
  });
  return { props: { games, season: index.season, builtAt: now.toISOString() } };
};

export default function UnreportedPage({ games, season, builtAt }: UnreportedProps) {
  return (
    <>
      <Head>
        <title>Unreported games · USA Club Rugby Eligibility</title>
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: 'Unreported games' }]} />
      <h1>Unreported games</h1>
      <p className="lead">
        {season} games whose record in Rugby Xplorer still needs entering, more than {UNREPORTED_LEEWAY_DAYS} days
        after kickoff: no result, a result with no lineup for a side, or a side that listed more than {FULL_SIDE} players with
        no substitute recorded coming on. A missing substitution is a flag to check, not a proven error.{' '}
        <PageLink href="/methodology">How this list is worked out</PageLink>.
      </p>
      <p className="small">
        Counted on {formatDate(builtAt)}. Each date
        links to the match in Rugby Xplorer.
      </p>
      <UnreportedGames games={games} />
    </>
  );
}
