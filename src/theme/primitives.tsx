import {
  Container,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';

// Themed building blocks for layout the theme's component overrides can't reach.
// They take their spacing, colours and breakpoints from the theme.

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
}));

export const Section = styled('section')(({ theme }) => ({ marginBottom: theme.spacing(4) }));

/** A padded surface. */
export const Panel = styled(Paper, { shouldForwardProp: notForwarded('pad', 'below') })<{
  pad?: number;
  below?: number;
}>(({ theme, pad = 2, below = 0 }) => ({
  padding: theme.spacing(pad),
  marginBottom: theme.spacing(below),
}));

export const ScrollX = styled('div')(({ theme }) => ({ overflowX: 'auto', margin: theme.spacing(2, 0) }));

export const Pre = styled('pre')({ overflowX: 'auto' });

// App shell

export const Shell = styled('div')({ display: 'flex', flexDirection: 'column', minHeight: '100dvh' });

export const Main = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  flexGrow: 1,
})) as typeof Container;

export const Footer = styled('footer')(({ theme }) => ({
  ...theme.typography.body2,
  padding: theme.spacing(3, 0),
  textAlign: 'center',
  color: (theme.vars || theme).palette.text.secondary,
}));

export const BrandLink = styled(Link)({ flexGrow: 1 }) as typeof Link;

// Tables

// Forms

