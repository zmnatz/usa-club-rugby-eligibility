import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { EligibilityReport } from '@/components/EligibilityReport';
import { clubFixtures, type ParticipationSnapshot } from '@/utils/participation';
import { readClubSnapshot, readFixtures, readIndex, type PublishedClub } from '@/utils/published';
import type { FeedFixture } from '@/utils/feeds';

interface ClubPageProps {
  club: PublishedClub;
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

export const getStaticPaths: GetStaticPaths = async () => {
  return {
    paths: readIndex().clubs.map((club) => ({ params: { club: club.key } })),
    fallback: false,
  };
};

export const getStaticProps: GetStaticProps<ClubPageProps> = async ({ params }) => {
  const key = Array.isArray(params?.club) ? params?.club[0] : params?.club;
  const club = readIndex().clubs.find((candidate) => candidate.key === key);
  if (!club) return { notFound: true };

  return {
    props: {
      club,
      saved: readClubSnapshot(club.key),
      // The fixtures in the club's divisions, including playoff dates with no
      // teams assigned, which its possible matches are worked out from.
      fixtures: clubFixtures(readFixtures(), club),
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
      <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
        <MuiLink component={NextLink} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <Typography color="text.primary">{club.name}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {club.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {club.sides.map((side) => side.teamName).join(' · ')}
      </Typography>
      <EligibilityReport source="record" club={club} saved={saved} fixtures={fixtures} />
    </>
  );
}
