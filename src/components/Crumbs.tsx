import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/** A link between the site's own pages. Next prefetches every link it renders when it is
 *  hovered, and a page can link to hundreds of clubs, so it is switched off. */
export function PageLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}

export interface Crumb {
  label: string;
  /** Omitted for the page itself. */
  href?: string;
}

/** Where a page sits, as a breadcrumb trail; the last crumb is the current page. */
export function Crumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="breadcrumb">
      <ol>
        {trail.map(({ label, href }) => (
          <li key={label} aria-current={href ? undefined : 'page'}>
            {href ? <PageLink href={href}>{label}</PageLink> : label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
