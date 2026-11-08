import type { ComponentProps, ComponentType } from 'react';
import { Link, Paper, type PaperProps, TextField, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Themed building blocks. Spacing, colours and breakpoints come from the host's
// MUI theme, so the components work under any of them. Each has an explicit type,
// so the package's published types don't depend on MUI's internal styling packages.

const notForwarded = (...names: string[]) => (prop: PropertyKey) => !names.includes(String(prop));

/** A flex row. `gap` and `below` are theme spacing units. */
export const Row = styled('div', { shouldForwardProp: notForwarded('gap', 'below', 'between', 'stretch') })<{
  gap?: number;
  below?: number;
  between?: boolean;
  stretch?: boolean;
}>(({ theme, gap = 1, below = 0, between = false, stretch = false }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: stretch ? 'stretch' : 'center',
  justifyContent: between ? 'space-between' : undefined,
  gap: theme.spacing(gap),
  marginBottom: theme.spacing(below),
})) as ComponentType<ComponentProps<'div'> & { gap?: number; below?: number; between?: boolean; stretch?: boolean }>;

/** A padded surface. */
export const Panel = styled(Paper, { shouldForwardProp: notForwarded('pad', 'below') })<{
  pad?: number;
  below?: number;
}>(({ theme, pad = 2, below = 0 }) => ({
  padding: theme.spacing(pad),
  marginBottom: theme.spacing(below),
})) as ComponentType<PaperProps & { pad?: number; below?: number }>;

// Club directory

export const SearchField = styled(TextField)({ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }) as typeof TextField;

export const ClubList = styled('ul')(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: '1fr',
  columnGap: theme.spacing(3),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: '1fr 1fr' },
  [theme.breakpoints.up('md')]: { gridTemplateColumns: '1fr 1fr 1fr' },
})) as ComponentType<ComponentProps<'ul'>>;

export const ClubItem = styled('li')(({ theme }) => ({
  borderBottom: `1px solid ${(theme.vars || theme).palette.divider}`,
})) as ComponentType<ComponentProps<'li'>>;

export const ClubLink = styled(Link)(({ theme }) => ({ display: 'block', padding: theme.spacing(1, 0) })) as typeof Link;

export const SideLabels = styled(Typography)(({ theme }) => ({ marginLeft: theme.spacing(1) })) as typeof Typography;

export const EmptyNote = styled(Typography)(({ theme }) => ({ padding: theme.spacing(2, 0) })) as typeof Typography;
