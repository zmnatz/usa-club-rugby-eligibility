import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { EligibilityStatusChip, PlayerDetailBody } from '@zmnatz/usa-club-rugby-components';
import type { PlayerClubEntry, PlayerProfile } from '@zmnatz/usa-club-rugby-data';
import { Crumbs, PageLink } from '@/components/Crumbs';
import { clubPath } from '@/utils/paths';
import { type PlayerBucketFile, playerBucket, playerBucketFile } from '@/utils/playerBuckets';

// One page for every player, chosen by `?id=<cms-id>`. The player's profile is loaded in
// the browser from their bucket's file, which holds a few dozen players, so a deploy
// carries a few hundred files rather than one page per player (ADR 007).

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

type Loaded = { id: string; profile: PlayerProfile | null } | { id: string; failed: true };

/** The player's profile once their bucket is loaded: null if they aren't in it. */
function usePlayer(id: string | null): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!id) return;
    let current = true;
    fetch(`${BASE_PATH}/${playerBucketFile(playerBucket(id))}`)
      .then((response) => {
        // A bucket with no players in this build has no file.
        if (response.status === 404) return { generatedAt: '', players: {} } as PlayerBucketFile;
        if (!response.ok) throw new Error(`${response.status}`);
        return response.json() as Promise<PlayerBucketFile>;
      })
      .then(
        (file) => current && setLoaded({ id, profile: Object.hasOwn(file.players, id) ? file.players[id] : null }),
        () => current && setLoaded({ id, failed: true }),
      );
    return () => {
      current = false;
    };
  }, [id]);
  return loaded?.id === id ? loaded : null;
}

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

const PlayerBreadcrumbs = ({ name }: { name?: string }) => (
  <Crumbs trail={[{ label: 'All clubs', href: '/' }, { label: name ?? 'Player' }]} />
);

/** One player's verdict and the matches behind it. A player can have played for several
 *  clubs, so there is a section for each: eligibility is worked out within a club. */
function PlayerProfileView({ data }: { data: PlayerProfile }) {
  return (
    <>
      <Head>
        <title>{`${data.name} · USA Club Rugby Eligibility`}</title>
        <meta
          name="description"
          content={`NCS eligibility for ${data.name}, worked out from the Rugby Xplorer match record.`}
        />
      </Head>
      <PlayerBreadcrumbs name={data.name} />
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

function PlayerMessage({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PlayerBreadcrumbs />
      {children}
    </>
  );
}

/** A player's page, from `?id=<cms-id>`. Name Withheld players aren't in the data. */
export default function PlayerPage() {
  const { isReady, query } = useRouter();
  const id = typeof query.id === 'string' && query.id ? query.id : null;
  const loaded = usePlayer(id);
  // Next reports the router ready in the browser but not while prerendering, so wait
  // a render to match the static HTML.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const head = (
    <Head>
      <title>Player · USA Club Rugby Eligibility</title>
    </Head>
  );
  if (!hydrated || !isReady || (id && !loaded)) {
    return (
      <PlayerMessage>
        {head}
        <p className="loading" role="status">Loading the player…</p>
      </PlayerMessage>
    );
  }
  if (!id || !loaded) {
    return (
      <PlayerMessage>
        {head}
        <div className="ec-alert ec-alert--info">
          Choose a player from <PageLink href="/">their club&apos;s page</PageLink>.
        </div>
      </PlayerMessage>
    );
  }
  if ('failed' in loaded) {
    return (
      <PlayerMessage>
        {head}
        <div className="ec-alert ec-alert--error" role="alert">The player couldn&apos;t be loaded. Try again.</div>
      </PlayerMessage>
    );
  }
  if (!loaded.profile) {
    return (
      <PlayerMessage>
        {head}
        <div className="ec-alert ec-alert--error" role="alert">
          No player with CMS ID &ldquo;{id}&rdquo; is in this season&apos;s record. Players whose name is withheld
          have no page.
        </div>
      </PlayerMessage>
    );
  }
  return <PlayerProfileView data={loaded.profile} />;
}
