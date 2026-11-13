import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';
import { EligibilityLinksProvider, SkipToFirstPlayer } from '@zmnatz/usa-club-rugby-html';
import '@zmnatz/usa-club-rugby-html/styles.css';
import '@/styles/site.css';
import { PageLink } from '@/components/Crumbs';
import { ISSUES_URL, REPO_URL, routes } from '@/utils/paths';

const DESCRIPTION =
  'NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record.';

// The package links to every club and player on a page, often hundreds of them.
function PackageLink(props: ComponentProps<typeof PageLink>) {
  return <PageLink {...props} />;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const clubReport = router.pathname === '/club/[club]' || (router.pathname === '/season' && Boolean(router.query.club));
  const narrow = router.pathname === '/methodology';

  return (
    <EligibilityLinksProvider Link={PackageLink} routes={routes}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={DESCRIPTION} />
        <title>USA Club Rugby Eligibility</title>
      </Head>
      <div className="site">
        {clubReport && <SkipToFirstPlayer />}
        <header className="site-header">
          <nav aria-label="Site">
            <PageLink href="/" className="brand">
              USA Club Rugby Eligibility
            </PageLink>
            <PageLink href="/methodology">Methodology</PageLink>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source
            </a>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Report a problem
            </a>
          </nav>
        </header>
        <main className={narrow ? 'narrow' : undefined}>
          <Component {...pageProps} />
        </main>
        <footer className="site-footer">Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.</footer>
      </div>
    </EligibilityLinksProvider>
  );
}
