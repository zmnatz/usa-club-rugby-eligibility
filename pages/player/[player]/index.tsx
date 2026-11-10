import type { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import type { PlayerClubEntry, PlayerProfile } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { EligibilityStatusChip, PlayerDetailBody } from '@/eligibility';
import { HISTORY_RELOAD_SCRIPT } from '@/utils/historyReload';
import { clubPath } from '@/utils/paths';
import { listPlayerIds, published } from '@/utils/published';

// The page is only text and links, so it ships no Next runtime and links out of it
// are full page loads. The inline script only reloads it on history navigation.
export const config = { unstable_runtimeJS: false };

/** Every player in the nightly data. Players can change clubs, so a player's page
 *  is under no club. Name Withheld players have no page. */
export const getStaticPaths: GetStaticPaths = async () => ({
  paths: (await listPlayerIds()).map((player) => ({ params: { player } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<{ data: PlayerProfile }> = async ({ params }) => {
  const data = typeof params?.player === 'string' ? await published.player(params.player) : null;
  return data ? { props: { data } } : { notFound: true };
};

/** A player's verdict in one club. */
function PlayerInClub({ entry }: { entry: PlayerClubEntry }) {
  return (
    <section>
      <div className="ec-row" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          <PageLink href={clubPath(entry.clubKey)}>{entry.clubName}</PageLink>
          {entry.sideLabel && ` · ${entry.sideLabel}`}
        </h2>
        <EligibilityStatusChip player={entry.player} />
        {entry.showCmsId && <span className="ec-muted ec-small">CMS ID {entry.player.playerId}</span>}
      </div>
      <div className="ec-card">
        <PlayerDetailBody player={entry.player} source="record" ownLabel={entry.sideLabel} fixtures={entry.fixtures} />
      </div>
    </section>
  );
}

/** One player's verdict and the matches behind it, on a page of its own so it can
 *  be linked to. A player can have played for several clubs, so there is a section
 *  for each: eligibility is worked out within a club. Built from the nightly data. */
export default function PlayerPage({ data }: { data: PlayerProfile }) {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no data in it */}
      <script dangerouslySetInnerHTML={{ __html: HISTORY_RELOAD_SCRIPT }} />
      <Head>
        <title>{`${data.name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS eligibility for ${data.name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: data.name }]} />
      <h1>{data.name}</h1>
      {data.clubs.length > 1 && (
        <p className="small">
          Listed {data.clubs.length} times in the record, for different clubs or sides. Each is assessed on its own.
        </p>
      )}
      <div className="ec-stack" style={{ gap: 32 }}>
        {data.clubs.map((entry) => (
          <PlayerInClub key={`${entry.clubKey}-${entry.player.teamName}`} entry={entry} />
        ))}
      </div>
    </>
  );
}
