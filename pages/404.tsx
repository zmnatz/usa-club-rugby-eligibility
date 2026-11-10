import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { CircularProgress, Link as MuiLink, Typography } from '@mui/material';
import { playerPath, queryPlayerId } from '@/utils/paths';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Player pages were briefly one page at /player/?id=<cms-id> (ADR 007), which the host
 *  now answers with this page. Sends those links on to the player's own page. */
function useLegacyPlayerRedirect(): boolean {
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const id = queryPlayerId(pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) : pathname, search);
    if (id === null) return;
    setRedirecting(true);
    window.location.replace(`${BASE_PATH}${playerPath(id)}/${hash}`);
  }, []);
  return redirecting;
}

export default function NotFoundPage() {
  if (useLegacyPlayerRedirect()) return <CircularProgress aria-label="Opening the player's page" />;
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Typography color="text.secondary">
        That club or page isn&apos;t here. <MuiLink component={NextLink} prefetch={false} href="/">Choose a club
        from the full list</MuiLink>.
      </Typography>
    </>
  );
}
