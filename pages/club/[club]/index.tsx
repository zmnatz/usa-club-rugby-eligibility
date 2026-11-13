import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ClubEligibilityReport } from '@zmnatz/usa-club-rugby-html';
import {
  clubFixtures,
  type FeedFixture,
  type ParticipationSnapshot,
} from '@zmnatz/usa-club-rugby-data';
import { Crumbs } from '@/components/Crumbs';
import { clubPath, clubPlayerPath, openPlayer } from '@/utils/paths';
import { published, type PublishedClub } from '@/utils/published';

interface ClubPageProps {
  club: PublishedClub;
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

// No club page is generated at build time. The first request for one renders it in
// full (verdicts and match table in the HTML) and it is cached until the next deploy,
// which is the only time the data changes; there is no revalidate (ADR 014). The
// function reads only the files listed for this route in next.config.ts.
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<ClubPageProps> = async ({ params }) => {
  const key = Array.isArray(params?.club) ? params?.club[0] : params?.club;
  const club = (await published.clubs()).find((candidate) => candidate.key === key);
  // A key that isn't in the published index is the site's 404, cached like a page.
  if (!club) return { notFound: true };
  const [{ snapshot }, fixtures] = await Promise.all([published.club(club.key), published.fixtures()]);

  return {
    props: {
      club,
      saved: snapshot,
      // The fixtures in the club's divisions, including playoff dates with no
      // teams assigned, which its possible matches are worked out from.
      fixtures: clubFixtures(fixtures, club),
    },
  };
};

export default function ClubPage({ club, saved, fixtures }: ClubPageProps) {
  // A player's detail is open over the report when the URL names them: /club/<key>/?player=<id>.
  const router = useRouter();
  return (
    <>
      <Head>
        <title>{`${club.name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS player eligibility for ${club.name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: club.name }]} />
      <h1>{club.name}</h1>
      <p className="small">{club.sides.map((side) => side.teamName).join(' · ')}</p>
      <ClubEligibilityReport
        club={club}
        saved={saved}
        fixtures={fixtures}
        playerId={openPlayer(router.query)}
        playerHref={(playerId) => clubPlayerPath(club.key, playerId)}
        onClose={() => router.push(clubPath(club.key), undefined, { shallow: true, scroll: false })}
      />
    </>
  );
}
