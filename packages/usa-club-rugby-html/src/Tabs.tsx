import type { ReactNode } from 'react';
import { useEligibilityLinks } from './links.tsx';

export interface TabItem {
  /** Unique among the tabs; also makes the tab's element id. */
  key: string;
  label: ReactNode;
  /** Where the tab goes: the host keeps the open tab in its URL. */
  href: string;
}

export interface TabsProps {
  /** What the tabs choose between, for screen readers, e.g. "Season". */
  label: string;
  tabs: TabItem[];
  /** The open tab's key. */
  selected: string;
  /** The open tab's content. */
  children: ReactNode;
}

/** A row of tabs over one panel. Each tab is a link, so the open tab lives in the host's
 *  URL and Back steps between them; the component keeps no state of its own. */
export function Tabs({ label, tabs, selected, children }: TabsProps) {
  const { Link } = useEligibilityLinks();
  const id = (key: string) => `ec-tab-${key}`;
  return (
    <>
      <div className="ec-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            role="tab"
            id={id(tab.key)}
            aria-selected={tab.key === selected}
            aria-controls="ec-tabpanel"
            className="ec-tab"
          >
            {tab.label}
          </Link>
        ))}
      </div>
      <div id="ec-tabpanel" role="tabpanel" aria-labelledby={id(selected)}>
        {children}
      </div>
    </>
  );
}
