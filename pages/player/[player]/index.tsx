import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { PlayerPage } from '@/components/PlayerPage';
import { listPlayerIds, readPlayerPage, type PlayerPageData } from '@/utils/playerDb';

/** Every player in the nightly data, from the player database that
 *  `bun run players` builds. Players can change clubs, so a player's page is under
 *  no club. Name Withheld players aren't in the database, so have no page. */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: listPlayerIds().map((player) => ({ params: { player } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<{ data: PlayerPageData }> = async ({ params }) => {
  const data = typeof params?.player === 'string' ? readPlayerPage(params.player) : null;
  return data ? { props: { data } } : { notFound: true };
};

export default function PlayerRoute({ data }: { data: PlayerPageData }) {
  return (
    <>
      <Head>
        <title>{`${data.name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS eligibility for ${data.name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <PlayerPage data={data} />
    </>
  );
}
