import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import { Breadcrumbs, Link as MuiLink, Typography } from '@mui/material';
import { ClubDirectory } from '@zmnatz/usa-club-rugby-components';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { seasonClubPath } from '@/utils/paths';
import { type PublishedSeasonFile, readSeasonFile, readSeasons } from '@/utils/published';

// Text, links and a filter, as on the home page: no Next runtime.
export const config = { unstable_runtimeJS: false };

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: readSeasons().map(({ slug }) => ({ params: { season: slug } })),
  fallback: false,
});

type SeasonSummary = Pick<PublishedSeasonFile, 'season' | 'slug' | 'clubs' | 'unplacedTeams'>;

export const getStaticProps: GetStaticProps<{ data: SeasonSummary }> = async ({ params }) => {
  if (typeof params?.season !== 'string') return { notFound: true };
  const { season, slug, clubs, unplacedTeams } = readSeasonFile(params.season);
  return { props: { data: { season, slug, clubs, unplacedTeams } } };
};

/** The clubs of one Locked Season, each linking to that season's report. */
export default function SeasonPage({ data }: { data: SeasonSummary }) {
  const { season, slug, clubs, unplacedTeams } = data;
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
      <script dangerouslySetInnerHTML={{ __html: HISTORY_RELOAD_SCRIPT }} />
      <Head>
        <title>{`${season} season · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`Final NCS player eligibility for the ${season} season, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
          All clubs
        </MuiLink>
        <Typography color="text.primary">{season}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {season} season
      </Typography>
      <Typography color="textSecondary" gutterBottom>
        Final verdicts under that season&apos;s regulations.{' '}
        <MuiLink component={NextLink} prefetch={false} href="/methodology">
          How this report is worked out
        </MuiLink>
        .
      </Typography>
      {unplacedTeams.length > 0 && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {unplacedTeams.length} {unplacedTeams.length === 1 ? 'team' : 'teams'} couldn&apos;t be placed in a division, so
          aren&apos;t assessed.
        </Typography>
      )}
      <ClubDirectory
        clubs={clubs}
        autoFocus
        staticFilter={process.env.NODE_ENV === 'production'}
        clubHref={(key) => seasonClubPath(slug, key)}
      />
    </>
  );
}
