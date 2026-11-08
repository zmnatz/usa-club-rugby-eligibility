import Head from 'next/head';
import NextLink from 'next/link';
import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { MatchParticipationReport } from '@zmnatz/usa-club-rugby-components';
import { loadFixtures } from '@/utils/data';

export default function CsvPage() {
  // A report can be for any club, so this is the national fixture list.
  const { data: fixtures } = useQuery({ queryKey: ['eligibility-fixtures'], queryFn: loadFixtures });
  return (
    <>
      <Head>
        <title>Match Participation Report · USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="Check a Rugby Xplorer Match Participation Report for any club against the NCS eligibility rules."
        />
      </Head>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <Typography color="text.primary">CSV report</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        Match Participation Report
      </Typography>
      <MatchParticipationReport fixtures={fixtures} />
    </>
  );
}
