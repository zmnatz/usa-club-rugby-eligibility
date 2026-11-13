import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { ClubDirectory, ReportProblemNote, SeasonRules } from '@zmnatz/usa-club-rugby-html';
import type { PublishedSeasonFile } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { seasonClubPath, seasonsPath, statsPath } from '@/utils/paths';
import { lockedSeason } from '@/utils/published';

/** What the season's page shows: its clubs, without their files or the fixtures. */
type SeasonPageProps = Pick<PublishedSeasonFile, 'season' | 'slug' | 'clubs' | 'unplacedTeams'>;

// Generated on first request and cached until the next deploy, like a club page
// (ADRs 014, 016). The function reads the season's file and passes on only its clubs.
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<SeasonPageProps> = async ({ params }) => {
  const file = await lockedSeason(params?.season);
  if (!file) return { notFound: true };
  const { season, slug, clubs, unplacedTeams } = file;
  return { props: { season, slug, clubs, unplacedTeams } };
};

/** A Locked Season's clubs. */
export default function SeasonPage({ season, slug, clubs, unplacedTeams }: SeasonPageProps) {
  return (
    <>
      <Head>
        <title>{`${season} season · USA Club Rugby Eligibility`}</title>
      </Head>
      <Crumbs
        trail={[{ label: 'All clubs', href: '/' }, { label: 'Past seasons', href: seasonsPath }, { label: season }]}
      />
      <h1>{season} season</h1>
      <p className="lead">
        Final verdicts under that season&apos;s regulations. <PageLink href="/methodology">How this report is worked out</PageLink>.
      </p>
      <ReportProblemNote season={season} locked />
      <div className="ec-stack" style={{ marginBottom: 16 }}>
        <SeasonRules season={season} />
        <PageLink href={statsPath(slug)} className="ec-btn" style={{ alignSelf: 'flex-start' }}>
          Season Stats
        </PageLink>
      </div>
      <ClubDirectory clubs={clubs} autoFocus clubHref={(key) => seasonClubPath(slug, key)} />
      {unplacedTeams.length > 0 && (
        <section className="section-gap">
          <h2>Not matched to a division</h2>
          <p className="small">In the {season} record, with no verdicts: {unplacedTeams.join(' · ')}</p>
        </section>
      )}
    </>
  );
}
