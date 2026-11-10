import { useEffect, useState } from 'react';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import {
  Alert,
  Breadcrumbs,
  Card,
  CardContent,
  CircularProgress,
  Link as MuiLink,
  Stack,
  Typography,
} from '@mui/material';
import { EligibilityStatusChip, PlayerDetailBody } from '@zmnatz/usa-club-rugby-components';
import type { PlayerClubEntry, PlayerProfile } from '@zmnatz/usa-club-rugby-data';
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
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
        <Typography variant="h5" component="h2">
          <MuiLink component={NextLink} prefetch={false} href={clubPath(entry.clubKey)} underline="hover">
            {entry.clubName}
          </MuiLink>
          {entry.sideLabel && ` · ${entry.sideLabel}`}
        </Typography>
        <EligibilityStatusChip player={entry.player} />
        {entry.showCmsId && (
          <Typography variant="body2" color="text.secondary">
            CMS ID {entry.player.playerId}
          </Typography>
        )}
      </Stack>
      <Card component="section">
        <CardContent>
          <PlayerDetailBody
            player={entry.player}
            source="record"
            ownLabel={entry.sideLabel}
            fixtures={entry.fixtures}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function PlayerBreadcrumbs({ name }: { name?: string }) {
  return (
    <Breadcrumbs aria-label="breadcrumb">
      <MuiLink component={NextLink} prefetch={false} href="/" underline="hover" color="inherit">
        All clubs
      </MuiLink>
      <Typography color="text.primary">{name ?? 'Player'}</Typography>
    </Breadcrumbs>
  );
}

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
      <Typography variant="h4" component="h1" gutterBottom>
        {data.name}
      </Typography>
      {data.clubs.length > 1 && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Listed {data.clubs.length} times in the record, for different clubs or sides. Each is assessed on its own.
        </Typography>
      )}
      <Stack spacing={4} useFlexGap>
        {data.clubs.map((entry) => (
          <PlayerInClub key={`${entry.clubKey}-${entry.player.teamName}`} entry={entry} />
        ))}
      </Stack>
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
        <CircularProgress aria-label="Loading the player" />
      </PlayerMessage>
    );
  }
  if (!id || !loaded) {
    return (
      <PlayerMessage>
        {head}
        <Alert severity="info">
          Choose a player from{' '}
          <MuiLink component={NextLink} prefetch={false} href="/">
            their club&apos;s page
          </MuiLink>
          .
        </Alert>
      </PlayerMessage>
    );
  }
  if ('failed' in loaded) {
    return (
      <PlayerMessage>
        {head}
        <Alert severity="error">The player couldn&apos;t be loaded. Try again.</Alert>
      </PlayerMessage>
    );
  }
  if (!loaded.profile) {
    return (
      <PlayerMessage>
        {head}
        <Alert severity="error">
          No player with CMS ID &ldquo;{id}&rdquo; is in this season&apos;s record. Players whose name is withheld
          have no page.
        </Alert>
      </PlayerMessage>
    );
  }
  return <PlayerProfileView data={loaded.profile} />;
}
