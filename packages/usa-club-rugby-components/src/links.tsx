import { createContext, type ElementType, type ReactNode, useContext, useMemo } from 'react';

/** Where the host app serves each page. Include any base path the Link doesn't add. */
export interface EligibilityRoutes {
  club: (clubKey: string) => string;
  player: (playerId: string) => string;
  methodology: () => string;
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
