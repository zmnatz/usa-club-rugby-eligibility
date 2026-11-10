import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { ClubEligibilityReport } from '@zmnatz/usa-club-rugby-components';
import {
  clubFixtures,
  type FeedFixture,
  type ParticipationSnapshot,
} from '@zmnatz/usa-club-rugby-data';
import { Crumbs } from '@/components/Crumbs';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { selectClubs } from '@/utils/buildScope';
import { published, type PublishedClub } from '@/utils/published';

interface ClubPageProps {
  club: PublishedClub;
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

// The report is complete HTML, so the page ships no Next runtime: its tables sort, and its
// export downloads, from the site-wide script. An inline one reloads on history navigation.
export const config = { unstable_runtimeJS: false };

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: selectClubs(await published.clubs()).map((club) => ({ params: { club: club.key } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ClubPageProps> = async ({ params }) => {
  const key = Array.isArray(params?.club) ? params?.club[0] : params?.club;
  const club = (await published.clubs()).find((candidate) => candidate.key === key);
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
  return (
    <>
      <Head>
        <title>{`${club.name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS player eligibility for ${club.name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
      <script dangerouslySetInnerHTML={{ __html: HISTORY_RELOAD_SCRIPT }} />
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: club.name }]} />
      <h1>{club.name}</h1>
      <p className="small">{club.sides.map((side) => side.teamName).join(' · ')}</p>
      <ClubEligibilityReport club={club} saved={saved} fixtures={fixtures} />
    </>
  );
}
