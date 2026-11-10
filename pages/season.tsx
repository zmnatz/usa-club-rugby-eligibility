import { useEffect, useState } from 'react';
import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ClubDirectory, ClubEligibilityReport, ReportProblemNote, SeasonRules } from '@/eligibility';
import { clubFixtures, createPublishedClient, type PublishedSeasonFile } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { seasonClubPath, seasonPath, statsPath } from '@/utils/paths';
import { published, type PublishedSeason } from '@/utils/published';

// One page for every Locked Season, so past seasons add nothing to the build. The
// query says which season and club; the season's file is loaded in the browser.
const client = createPublishedClient({ baseUrl: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/data` });

export const getStaticProps: GetStaticProps<{ seasons: PublishedSeason[] }> = async () => ({
  props: { seasons: await published.seasons() },
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
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: 'Past seasons' }]} />
      <h1>Past seasons</h1>
      {seasons.length === 0 && <p className="lead">No past seasons are published yet.</p>}
      <ul className="ec-list ec-stack-sm">
        {seasons.map(({ season, slug, clubs }) => (
          <li key={slug}>
            <PageLink href={seasonPath(slug)}>{season}</PageLink> · {clubs} clubs
          </li>
        ))}
      </ul>
    </>
  );
}

function SeasonClubs({ file }: { file: PublishedSeasonFile }) {
  const { season, slug, clubs, unplacedTeams } = file;
  return (
    <>
      <PageHead title={`${season} season`} />
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: season }]} />
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

function SeasonClub({ file, clubKey }: { file: PublishedSeasonFile; clubKey: string }) {
  const club = file.clubs.find((candidate) => candidate.key === clubKey);
  if (!club) {
    return (
      <div className="ec-alert ec-alert--error" role="alert">
        No club &ldquo;{clubKey}&rdquo; in the {file.season} season.
      </div>
    );
  }
  return (
    <>
      <PageHead title={`${club.name} ${file.season}`} />
      <Crumbs
        trail={[{ label: 'All clubs', href: '/' }, { label: file.season, href: seasonPath(file.slug) }, { label: club.name }]}
      />
      <h1>{club.name}</h1>
      <p className="small">{club.sides.map((side) => side.teamName).join(' · ')}</p>
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

  if (!hydrated || !isReady) return <p className="loading" role="status">Loading…</p>;
  if (param === null) return <SeasonList seasons={seasons} />;
  if (slug === null) return <div className="ec-alert ec-alert--error" role="alert">No past season &ldquo;{param}&rdquo; is published.</div>;
  if (!loaded) return <p className="loading" role="status">Loading the season…</p>;
  if (!loaded.file) return <div className="ec-alert ec-alert--error" role="alert">The {param} season couldn&apos;t be loaded. Try again.</div>;
  return clubKey ? <SeasonClub file={loaded.file} clubKey={clubKey} /> : <SeasonClubs file={loaded.file} />;
}
