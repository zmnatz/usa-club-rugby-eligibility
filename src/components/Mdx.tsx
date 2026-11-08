import type { ComponentProps } from 'react';
import NextLink from 'next/link';
import { Link as MuiLink, Typography } from '@mui/material';
import { Paragraph, Pre, ScrollX, SectionHeading, SubsectionHeading } from '@/theme';

// The methodology page is MDX, so its headings and links are mapped to the same
// MUI type scale as the report pages.
export const mdxComponents = {
  h1: (props: ComponentProps<'h1'>) => (
    <Typography component="h1" variant="h4" gutterBottom {...props} />
  ),
  h2: (props: ComponentProps<'h2'>) => (
    <SectionHeading {...props} />
  ),
  h3: (props: ComponentProps<'h3'>) => (
    <SubsectionHeading {...props} />
  ),
  p: (props: ComponentProps<'p'>) => (
    <Paragraph {...props} />
  ),
  a: ({ href, children, ...props }: ComponentProps<'a'>) => {
    const external =
      typeof href === 'string' &&
      (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('//'));
    if (external) {
      return (
        <MuiLink href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </MuiLink>
      );
    }
    return (
      <MuiLink component={NextLink} href={href ?? '/'} {...props}>
        {children}
      </MuiLink>
    );
  },
  table: (props: ComponentProps<'table'>) => (
    <ScrollX>
      <table {...props} />
    </ScrollX>
  ),
  pre: (props: ComponentProps<'pre'>) => (
    <Pre {...props} />
  ),
};
