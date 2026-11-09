import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { ClubEligibilityReport } from '@zmnatz/usa-club-rugby-components';
import { clubFixtures, type FeedFixture, type ParticipationSnapshot } from '@zmnatz/usa-club-rugby-data';
import { selectClubs } from '@/utils/buildScope';
import { seasonPath } from '@/utils/paths';
import { type PublishedClub, readSeasonFile, readSeasons } from '@/utils/published';

interface SeasonClubProps {
  slug: string;
  club: PublishedClub;
  saved: ParticipationSnapshot;
  fixtures: FeedFixture[];
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: readSeasons().flatMap(({ slug }) =>
    selectClubs(readSeasonFile(slug).clubs, { strict: false }).map((club) => ({
      params: { season: slug, club: club.key },
    })),
  ),
  fallback: false,
});

export const getStaticProps: GetStaticProps<SeasonClubProps> = async ({ params }) => {
  const slug = params?.season as string;
  const season = readSeasonFile(slug);
  const club = season.clubs.find((candidate) => candidate.key === params?.club);
  if (!club) return { notFound: true };
  return {
    props: {
      slug,
      club,
      saved: season.clubFiles[club.key],
      fixtures: clubFixtures(season.fixtures, club),
    },
  };
};

/** One club's final verdicts for a Locked Season. */
export default function SeasonClubPage({ slug, club, saved, fixtures }: SeasonClubProps) {
  return (
    <>
      <Head>
        <title>{`${club.name} ${saved.season} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`Final NCS player eligibility for ${club.name} in the ${saved.season} season, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <MuiLink component={NextLink} prefetch={false} href={seasonPath(slug)} underline="hover" color="inherit">
          {saved.season}
        </MuiLink>
        <Typography color="text.primary">{club.name}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {club.name}
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {club.sides.map((side) => side.teamName).join(' · ')}
      </Typography>
      <ClubEligibilityReport club={club} saved={saved} fixtures={fixtures} />
    </>
  );
}
