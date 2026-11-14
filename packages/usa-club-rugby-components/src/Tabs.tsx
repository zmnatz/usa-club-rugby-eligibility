import type { ReactNode } from 'react';
import { Box, Tab, Tabs as MuiTabs } from '@mui/material';
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
      <MuiTabs value={selected} aria-label={label} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
        {tabs.map((tab) => (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            component={Link}
            href={tab.href}
            id={id(tab.key)}
            aria-controls="ec-tabpanel"
          />
        ))}
      </MuiTabs>
      <Box id="ec-tabpanel" role="tabpanel" aria-labelledby={id(selected)}>
        {children}
      </Box>
    </>
  );
}
