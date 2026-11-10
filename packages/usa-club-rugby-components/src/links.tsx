import { createContext, type ElementType, type ReactNode, useContext, useMemo } from 'react';

/** Where the host app serves each page. Include any base path the Link doesn't add. */
export interface EligibilityRoutes {
  club: (clubKey: string) => string;
  player: (playerId: string) => string;
  methodology: () => string;
  /** Where people report a problem with a report. Without it, no report-a-problem note shows. */
  reportProblem?: (report?: ProblemReport) => string;
}

/** A report about a Locked Season, filled in so it can be reproduced from the archive.
 *  - `rules-engine`: the record is right, but a verdict looks wrong under that season's
 *    rules or team matching.
 *  - `archive-correction`: the archived record is wrong, or was corrected in Rugby Xplorer
 *    after the season locked. */
export interface ProblemReport {
  kind: 'rules-engine' | 'archive-correction';
  /** As the CMS names it, e.g. "2024/2025". */
  season: string;
  club?: { key: string; name: string };
}

export interface EligibilityLinks {
  /** Rendered for internal links, and given `href` and `children`. An anchor (`'a'`) works. */
  Link: ElementType;
  routes: EligibilityRoutes;
}

const LinksContext = createContext<EligibilityLinks | null>(null);

export interface EligibilityLinksProviderProps extends EligibilityLinks {
  children: ReactNode;
}

/** How the components link to the host's pages. Wrap the app in this once. */
export function EligibilityLinksProvider({ Link, routes, children }: EligibilityLinksProviderProps) {
  const value = useMemo(() => ({ Link, routes }), [Link, routes]);
  return <LinksContext.Provider value={value}>{children}</LinksContext.Provider>;
}

export function useEligibilityLinks(): EligibilityLinks {
  const links = useContext(LinksContext);
  if (!links) {
    throw new Error('Wrap the eligibility components in <EligibilityLinksProvider>.');
  }
  return links;
}
