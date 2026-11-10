import { useEffect, useState } from 'react';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { Alert, Breadcrumbs, CircularProgress, Link as MuiLink, Stack, Typography } from '@mui/material';
import { ClubDirectory, ClubEligibilityReport } from '@zmnatz/usa-club-rugby-components';
import { clubFixtures, createPublishedClient, type PublishedSeasonFile } from '@zmnatz/usa-club-rugby-data';
import { seasonClubPath, seasonPath } from '@/utils/paths';
import { readSeasons, type PublishedSeason } from '@/utils/published';

// One page for every Locked Season, so past seasons add nothing to the build. The
// query says which season and club; the season's file is loaded in the browser.
const client = createPublishedClient({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/data` });

export const getStaticProps: GetStaticProps<{ seasons: PublishedSeason[] }> = async () => ({
  props: { seasons: readSeasons() },
});

type Loaded = { slug: string; file: PublishedSeasonFile | null };

/** The season's file once loaded: `file` is null if it couldn't be. */
function useSeasonFile(slug: string | null): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!slug) return;
    let current = true;
    client.season(slug).then(
      (file) => current && setLoaded({ slug, file }),
      () => current && setLoaded({ slug, file: null }),
    );
    return () => {
      current = false;
    };
  }, [slug]);
  return loaded?.slug === slug ? loaded : null;
}

const allClubs = (
  <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
    All clubs
  </MuiLink>
);

function PageHead({ title }: { title: string }) {
  return (
    <Head>
      <title>{`${title} · USA Club Rugby Eligibility`}</title>
    </Head>
  );
}

function SeasonList({ seasons }: { seasons: PublishedSeason[] }) {
  return (
    <>
      <PageHead title="Past seasons" />
      <Breadcrumbs aria-label="breadcrumb">
        {allClubs}
        <Typography color="text.primary">Past seasons</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        Past seasons
      </Typography>
      {seasons.length === 0 && <Typography color="textSecondary">No past seasons are published yet.</Typography>}
      <Stack component="ul" spacing={1} useFlexGap sx={{ m: 0, pl: 3 }}>
        {seasons.map(({ season, slug, clubs }) => (
          <li key={slug}>
            <MuiLink component={NextLink} prefetch={false} href={seasonPath(slug)}>
              {season}
            </MuiLink>{' '}
            · {clubs} clubs
          </li>
        ))}
      </Stack>
    </>
  );
}

function SeasonClubs({ file }: { file: PublishedSeasonFile }) {
  const { season, slug, clubs, unplacedTeams } = file;
  return (
    <>
      <PageHead title={`${season} season`} />
      <Breadcrumbs aria-label="breadcrumb">
        {allClubs}
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
      <ClubDirectory clubs={clubs} autoFocus clubHref={(key) => seasonClubPath(slug, key)} />
      {unplacedTeams.length > 0 && (
        <section>
          <Typography variant="h6" component="h2" sx={{ mt: 3 }} gutterBottom>
            Not matched to a division
          </Typography>
          <Typography variant="body2" color="textSecondary">
            In the {season} record, with no verdicts: {unplacedTeams.join(' · ')}
          </Typography>
        </section>
      )}
    </>
  );
}

function SeasonClub({ file, clubKey }: { file: PublishedSeasonFile; clubKey: string }) {
  const club = file.clubs.find((candidate) => candidate.key === clubKey);
  if (!club) return <Alert severity="error">No club &ldquo;{clubKey}&rdquo; in the {file.season} season.</Alert>;
  return (
    <>
      <PageHead title={`${club.name} ${file.season}`} />
      <Breadcrumbs aria-label="breadcrumb">
        {allClubs}
        <MuiLink component={NextLink} prefetch={false} href={seasonPath(file.slug)} underline="hover" color="inherit">
          {file.season}
        </MuiLink>
        <Typography color="text.primary">{club.name}</Typography>
      </Breadcrumbs>
      <Typography variant="h4" component="h1" gutterBottom>
        {club.name}
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        {club.sides.map((side) => side.teamName).join(' · ')}
      </Typography>
      <ClubEligibilityReport
        key={`${file.slug}/${club.key}`}
        club={club}
        saved={file.clubFiles[club.key]}
        fixtures={clubFixtures(file.fixtures, club)}
      />
    </>
  );
}

/** A Locked Season's clubs or one club's report, from `?season=<slug>&club=<key>`.
 *  With no season, the list of them. */
export default function SeasonPage({ seasons }: { seasons: PublishedSeason[] }) {
  const { isReady, query } = useRouter();
  const param = typeof query.season === 'string' ? query.season : null;
  const clubKey = typeof query.club === 'string' ? query.club : null;
  // Only a published season is requested, so the query can't name another path.
  const slug = seasons.some((season) => season.slug === param) ? param : null;
  const loaded = useSeasonFile(slug);
  // Next reports the router ready in the browser but not while prerendering, so wait
  // a render to match the static HTML.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || !isReady) return <CircularProgress aria-label="Loading" />;
  if (param === null) return <SeasonList seasons={seasons} />;
  if (slug === null) return <Alert severity="error">No past season &ldquo;{param}&rdquo; is published.</Alert>;
  if (!loaded) return <CircularProgress aria-label="Loading the season" />;
  if (!loaded.file) return <Alert severity="error">The {param} season couldn&apos;t be loaded. Try again.</Alert>;
  return clubKey ? <SeasonClub file={loaded.file} clubKey={clubKey} /> : <SeasonClubs file={loaded.file} />;
}
