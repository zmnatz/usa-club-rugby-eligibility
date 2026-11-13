import type { GetStaticProps } from 'next';
import Head from 'next/head';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { seasonPath } from '@/utils/paths';
import { published, type PublishedSeason } from '@/utils/published';

// The Locked Seasons published, built with the site: it reads only seasons.json. Each
// season's page and its clubs' are generated on first request (ADR 016).

export const getStaticProps: GetStaticProps<{ seasons: PublishedSeason[] }> = async () => ({
  props: { seasons: await published.seasons() },
});

export default function SeasonsPage({ seasons }: { seasons: PublishedSeason[] }) {
  return (
    <>
      <Head>
        <title>Past seasons · USA Club Rugby Eligibility</title>
      </Head>
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
