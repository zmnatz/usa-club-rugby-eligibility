import type { GetStaticProps } from 'next';
import { clubPath } from '@/utils/paths';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Button, Link as MuiLink, Typography } from '@mui/material';
import { Row } from '@/theme';
import { ClubDirectory } from '@zmnatz/usa-club-rugby-components';
import { formatDateTime } from '@/utils/dates';
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

export default function HomePage({ clubs, season, generatedAt }: HomeProps) {
  const router = useRouter();
  // The old report put the club in ?club=<key>. Keep those links working.
  useEffect(() => {
    if (!router.isReady) return;
    const legacy = router.query.club;
    if (typeof legacy === 'string' && clubs.some((club) => club.key === legacy)) {
      router.replace(clubPath(legacy));
    }
  }, [router, clubs]);

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
        track (experimental). <MuiLink component={NextLink} href="/methodology">How this
        report is worked out</MuiLink>.
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {season} season · {clubs.length} clubs · data last changed {formatDateTime(generatedAt)}
      </Typography>
      <Row gap={2} below={3}>
        <Button component={NextLink} href="/csv" variant="outlined">
          Check a Match Participation Report (CSV)
        </Button>
      </Row>
      <ClubDirectory clubs={clubs} autoFocus />
    </>
  );
}
