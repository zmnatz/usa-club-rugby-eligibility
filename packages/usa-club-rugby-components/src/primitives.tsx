import type { ComponentProps, ComponentType } from 'react';
import { styled } from '@mui/material/styles';

// The only elements MUI has no component for. Each has a theme name, so a host can
// override it like any MUI component, and an explicit type, so the package's
// published types don't depend on MUI's internal styling packages.

/** Above the top of the page until focused from the keyboard. */
export const SkipLink = styled('a', { name: 'EligibilitySkipLink', slot: 'Root' })(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  zIndex: theme.zIndex.tooltip,
  padding: theme.spacing(1, 2),
  borderRadius: theme.shape.borderRadius,
  background: (theme.vars || theme).palette.background.paper,
  color: (theme.vars || theme).palette.primary.main,
  transform: 'translateY(-200%)',
  '&:focus-visible': {
    transform: 'none',
    outline: `2px solid ${(theme.vars || theme).palette.primary.main}`,
    outlineOffset: 2,
  },
})) as ComponentType<ComponentProps<'a'>>;

// Styles its rows as well, so they can be plain elements: there are hundreds of
// them, and a styled component for each part makes the page slow to hydrate.
export const ClubList = styled('ul', { name: 'EligibilityClubList', slot: 'Root' })(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: '1fr',
  columnGap: theme.spacing(3),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: '1fr 1fr' },
  [theme.breakpoints.up('md')]: { gridTemplateColumns: '1fr 1fr 1fr' },
  '& > li': { borderBottom: `1px solid ${(theme.vars || theme).palette.divider}` },
  '& > li > a': {
    display: 'block',
    padding: theme.spacing(1, 0),
    color: (theme.vars || theme).palette.primary.main,
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' },
  },
  '& > li > a > span': {
    ...theme.typography.caption,
    marginLeft: theme.spacing(1),
  },
})) as ComponentType<ComponentProps<'ul'>>;
