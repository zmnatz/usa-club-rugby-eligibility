import type { GetStaticPaths, GetStaticProps } from 'next';
import { PlayerPage } from '@/components/PlayerPage';
import { playerSeasonPath } from '@/utils/paths';
import { type PlayerPageProps, playerPage } from '@/utils/playerPage';

// No player page is built: each is generated on its first request and cached until the
// next deploy (ADR 015). Players can change clubs, so a player's page is under no club.
// It shows this season; each Locked Season has its own page, which a player who isn't in
// this season's record is sent to, so a season has one URL (ADR 017).
export const getStaticPaths: GetStaticPaths = async () => ({ paths: [], fallback: 'blocking' });

export const getStaticProps: GetStaticProps<PlayerPageProps> = async ({ params }) => {
  const id = typeof params?.player === 'string' ? params.player : null;
  const props = id ? await playerPage(id, null) : null;
  if (!props) return { notFound: true };
  const { slug } = props.shown;
  // Not permanent: the player may be in next season's record.
  if (slug !== null) return { redirect: { destination: `${playerSeasonPath(props.id, slug)}/`, permanent: false } };
  return { props };
};

export default PlayerPage;
