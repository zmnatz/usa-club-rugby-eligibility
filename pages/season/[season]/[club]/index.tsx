import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ClubEligibilityReport } from '@zmnatz/usa-club-rugby-html';
import {
  clubFixtures,
  type FeedFixture,
  type ParticipationSnapshot,
  type PublishedSeasonFile,
} from '@zmnatz/usa-club-rugby-data';
import { Crumbs } from '@/components/Crumbs';
import { openPlayer, seasonClubPath, seasonClubPlayerPath, seasonPath, seasonsPath } from '@/utils/paths';
import { lockedSeason } from '@/utils/published';

interface SeasonClubPageProps {
  season: string;
  slug: string;
  club: PublishedSeasonFile['clubs'][number];
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

// Generated on first request and cached until the next deploy, like a club page
// (ADRs 014, 016). The function reads the season's file and passes on only this club's
// report: its record and the fixtures in its divisions.
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<SeasonClubPageProps> = async ({ params }) => {
  const file = await lockedSeason(params?.season);
  const club = file?.clubs.find((candidate) => candidate.key === params?.club);
  const saved = club && file?.clubFiles[club.key];
  if (!file || !club || !saved) return { notFound: true };
  return {
    props: { season: file.season, slug: file.slug, club, saved, fixtures: clubFixtures(file.fixtures, club) },
  };
};

/** One club's final report for a Locked Season. */
export default function SeasonClubPage({ season, slug, club, saved, fixtures }: SeasonClubPageProps) {
  // A player's detail is open over the report when the URL names them: ?player=<id>.
  const router = useRouter();
  return (
    <>
      <Head>
        <title>{`${club.name} ${season} · USA Club Rugby Eligibility`}</title>
      </Head>
      <Crumbs
        trail={[
          { label: 'All clubs', href: '/' },
          { label: 'Past seasons', href: seasonsPath },
          { label: season, href: seasonPath(slug) },
          { label: club.name },
        ]}
      />
      <h1>{club.name}</h1>
      <p className="small">{club.sides.map((side) => side.teamName).join(' · ')}</p>
      <ClubEligibilityReport
        key={`${slug}/${club.key}`}
        club={club}
        saved={saved}
        fixtures={fixtures}
        playerId={openPlayer(router.query)}
        playerHref={(playerId) => seasonClubPlayerPath(slug, club.key, playerId)}
        onClose={() => router.push(seasonClubPath(slug, club.key), undefined, { shallow: true, scroll: false })}
      />
    </>
  );
}
