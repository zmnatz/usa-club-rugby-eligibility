import Head from 'next/head';
import { MatchParticipationReport } from '@zmnatz/usa-club-rugby-html';
import { createPublishedClient } from '@zmnatz/usa-club-rugby-data';
import { Crumbs } from '@/components/Crumbs';

// A report can be for any club, so it needs the national fixture list, which is too
// big to put in the page for visitors who never run one.
const { fixtures: loadFixtures } = createPublishedClient({
  baseUrl: '/data',
});

export default function CsvPage() {
  return (
    <>
      <Head>
        <title>Match Participation Report · USA Club Rugby Eligibility</title>
        <meta
          name="description"
          content="Check a Rugby Xplorer Match Participation Report for any club against the NCS eligibility rules."
        />
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: 'CSV report' }]} />
      <h1>Match Participation Report</h1>
      <MatchParticipationReport loadFixtures={loadFixtures} />
    </>
  );
}
