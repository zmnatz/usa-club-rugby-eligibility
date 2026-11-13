import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import { EligibilityLinksProvider, SkipToFirstPlayer } from "@zmnatz/usa-club-rugby-html";
import "@zmnatz/usa-club-rugby-html/styles.css";
import "@/styles/site.css";
import { PageLink } from "@/components/Crumbs";
import { ISSUES_URL, routes } from "@/utils/paths";

const DESCRIPTION =
  "NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record.";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const clubReport = router.pathname === "/club/[club]" || router.pathname === "/season/[season]/[club]";
  const narrow = router.pathname === "/methodology";

  return (
    <EligibilityLinksProvider Link={PageLink} routes={routes}>
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
            <PageLink href="/unreported">Unreported games</PageLink>
            <PageLink href="/changes">Data changes</PageLink>
            <PageLink href="/methodology">Methodology</PageLink>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
              Report a problem
            </a>
          </nav>
        </header>
        <main className={narrow ? "narrow" : undefined}>
          <Component {...pageProps} />
        </main>
        <footer className="site-footer">
          Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
        </footer>
      </div>
    </EligibilityLinksProvider>
  );
}
