import Head from 'next/head';
import { PageLink } from '@/components/Crumbs';
import { legacyPlayerId } from '@/utils/paths';

// Player pages were once at /player/<cms-id>/, which the static host now answers with
// this page. A small inline script sends those links on to the player's page (ADR 007),
// so the page needs no React runtime.
export const config = { unstable_runtimeJS: false };

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// The base path is the site's own, set at build time, so it is safe in a script. The
// pattern is `legacyPlayerId`, which is tested, written out as a function.
const LEGACY_PLAYER_REDIRECT = `(() => {
  const base = ${JSON.stringify(BASE_PATH)};
  const { pathname, hash } = window.location;
  const id = (${legacyPlayerId.toString()})(pathname.startsWith(base) ? pathname.slice(base.length) : pathname);
  if (id === null) return;
  document.documentElement.hidden = true;
  window.location.replace(base + '/player/?id=' + encodeURIComponent(id) + hash);
})();`;

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page not found · USA Club Rugby Eligibility</title>
      </Head>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, with no visitor data in it */}
      <script dangerouslySetInnerHTML={{ __html: LEGACY_PLAYER_REDIRECT }} />
      <h1>Page not found</h1>
      <p className="lead">
        That club or page isn&apos;t here. <PageLink href="/">Choose a club from the full list</PageLink>.
      </p>
    </>
  );
}
