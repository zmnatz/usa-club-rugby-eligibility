import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { PlayerPage } from '@/components/PlayerPage';
import type { PlayerProfile } from '@zmnatz/usa-club-rugby-data';
import { listPlayerIds, readPlayerPage } from '@/utils/playerPages';

/** Every player in the nightly data. Players can change clubs, so a player's page
 *  is under no club. Name Withheld players have no page. */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: listPlayerIds().map((player) => ({ params: { player } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<{ data: PlayerProfile }> = async ({ params }) => {
  const data = typeof params?.player === 'string' ? readPlayerPage(params.player) : null;
  return data ? { props: { data } } : { notFound: true };
};

export default function PlayerRoute({ data }: { data: PlayerProfile }) {
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
