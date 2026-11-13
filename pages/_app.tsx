import type { AppProps } from "next/app";
import Head from "next/head";
import { useRouter } from "next/router";
import type { ComponentProps } from "react";
import { EligibilityLinksProvider, SkipToFirstPlayer } from "@zmnatz/usa-club-rugby-html";
import "@zmnatz/usa-club-rugby-html/styles.css";
import "@/styles/site.css";
import { PageLink } from "@/components/Crumbs";
import { ISSUES_URL, routes } from "@/utils/paths";

const DESCRIPTION =
  "NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record.";

/** The page part of a link, without its query, hash or trailing slash. */
const pagePart = (href: string) => href.split(/[?#]/)[0].replace(/(.)\/$/, "$1");

// The package links to every club and player on a page, often hundreds of them. A link
// to the same page with another query, such as a player's detail over a club report,
// stays where it is: it re-renders the page without fetching it or scrolling.
function PackageLink(props: ComponentProps<typeof PageLink>) {
  const { asPath } = useRouter();
  const samePage = typeof props.href === "string" && pagePart(props.href) === pagePart(asPath);
  return <PageLink {...props} shallow={samePage} scroll={!samePage} />;
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const clubReport =
    router.pathname === "/club/[club]" ||
    (router.pathname === "/season" && Boolean(router.query.club));
  const narrow = router.pathname === "/methodology";

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
