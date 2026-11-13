import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  FULL_SIDE,
  formatDate,
  rulesForSeason,
  UNREPORTED_LEEWAY_DAYS,
  type UnreportedGame,
  unreportedGames,
} from '@zmnatz/usa-club-rugby-data';
import {
  DEFAULT_UNREPORTED,
  UNREPORTED_REASONS,
  type UnreportedFilters,
  UnreportedGames,
  type UnreportedReasonKind,
} from '@zmnatz/usa-club-rugby-html';
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

const queryValue = (value: string | string[] | undefined, none: string) =>
  typeof value === 'string' && value ? value : none;

/** The reasons turned on, written as `no-lineup,no-result`, or `all` when none is, which
 *  shows every game. */
const ALL_REASONS = 'all';
const readReasons = (value: string | string[] | undefined): UnreportedReasonKind[] => {
  if (typeof value !== 'string' || !value) return DEFAULT_UNREPORTED.reasons;
  const named = value.split(',');
  return UNREPORTED_REASONS.map(([kind]) => kind).filter((kind) => named.includes(kind));
};
const writeReasons = (reasons: UnreportedReasonKind[]) => (reasons.length ? reasons.join(',') : ALL_REASONS);

export default function UnreportedPage({ games, season, builtAt }: UnreportedProps) {
  // The filters live in the URL, so a refresh or a shared link keeps them; a filter left at
  // its default isn't written. The static HTML has no query, so it shows the defaults until
  // the router reads it.
  const router = useRouter();
  const filters: UnreportedFilters = router.isReady
    ? {
        division: queryValue(router.query.division, DEFAULT_UNREPORTED.division),
        competition: queryValue(router.query.competition, DEFAULT_UNREPORTED.competition),
        reasons: readReasons(router.query.reasons),
      }
    : DEFAULT_UNREPORTED;
  const setFilters = ({ division, competition, reasons }: UnreportedFilters) => {
    const written = writeReasons(reasons);
    const query = {
      ...(division !== DEFAULT_UNREPORTED.division && { division }),
      ...(competition !== DEFAULT_UNREPORTED.competition && { competition }),
      ...(written !== writeReasons(DEFAULT_UNREPORTED.reasons) && { reasons: written }),
    };
    router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
  };

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
      <UnreportedGames games={games} filters={filters} onFiltersChange={setFilters} />
    </>
  );
}
