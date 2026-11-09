import type { GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import { Button, Link as MuiLink, Typography } from '@mui/material';
import { ClubDirectory } from '@zmnatz/usa-club-rugby-components';
import { readIndex, type PublishedClub } from '@/utils/published';

interface HomeProps {
  clubs: PublishedClub[];
  season: string;
  generatedAt: string;
}

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const index = readIndex();
  return {
    props: { clubs: index.clubs, season: index.season, generatedAt: index.generatedAt },
  };
};

// A fixed locale and time zone, so the static HTML reads the same after hydration.
const formatDateTime = (dateTime: string) =>
  `${new Date(dateTime).toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;

export default function HomePage({ clubs, season, generatedAt }: HomeProps) {
  return (
    <>
      <Head>
        <title>USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record."
        />
      </Head>
      <Typography variant="h4" component="h1" gutterBottom>
        NCS Eligibility
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Pick a club to see which players are eligible for the National Championship Series,
        counted from the lineups and substitutions entered in Rugby Xplorer for every senior club
        league and local playoff match. Super Regionals, National Championships, 7s, friendlies,
        crossovers, Men&apos;s Division IV and Women&apos;s Division III don&apos;t count. Fixtures
        still to play before Super Regionals count towards the two-match minimums, shown as on
        track (experimental). <MuiLink component={NextLink} prefetch={false} href="/methodology">How this
        report is worked out</MuiLink>.
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {season} season · {clubs.length} clubs · data last changed {formatDateTime(generatedAt)}
      </Typography>
      <Button component={NextLink} prefetch={false} href="/csv" variant="outlined" sx={{ mb: 2 }}>
        Check a Match Participation Report (CSV)
      </Button>
      <ClubDirectory clubs={clubs} autoFocus />
    </>
  );
}
