import type { GetStaticPaths, GetStaticProps } from 'next';
import { PlayerPage } from '@/components/PlayerPage';
import { type PlayerPageProps, playerPage } from '@/utils/playerPage';

// A player's verdicts in one Locked Season, generated on first request like their page
// (ADRs 015, 017). A season they aren't in the record of is a 404.
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<PlayerPageProps> = async ({ params }) => {
  const id = typeof params?.player === 'string' ? params.player : null;
  const slug = typeof params?.season === 'string' ? params.season : null;
  const props = id && slug ? await playerPage(id, slug) : null;
  return props ? { props } : { notFound: true };
};

export default PlayerPage;
