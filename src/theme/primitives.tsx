import {
  Button,
  Container,
  DialogContent,
  FormControl,
  Link,
  Paper,
  TableCell,
  TableContainer,
  TableRow,
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

/** A block with theme-spaced margins. */
export const Block = styled('div', { shouldForwardProp: notForwarded('above', 'below') })<{
  above?: number;
  below?: number;
}>(({ theme, above = 0, below = 0 }) => ({
  marginTop: theme.spacing(above),
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

export const PlainList = styled('ul')(({ theme }) => ({ margin: 0, paddingLeft: theme.spacing(2.5) }));

export const ScrollX = styled('div')(({ theme }) => ({ overflowX: 'auto', margin: theme.spacing(2, 0) }));

export const Pre = styled('pre')({ overflowX: 'auto' });

/** Something shown in place of a value. */
export const Dim = styled('span')(({ theme }) => ({ color: (theme.vars || theme).palette.text.disabled }));

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

export const RoundsTable = styled(TableContainer)(({ theme }) => ({ marginTop: theme.spacing(1) })) as typeof TableContainer;

export const ClickableRow = styled(TableRow)({ cursor: 'pointer' });

export const NoWrapCell = styled(TableCell)({ whiteSpace: 'nowrap' });

export const BoldCell = styled(TableCell)(({ theme }) => ({ fontWeight: theme.typography.fontWeightBold }));

export const EmptyCell = styled(TableCell)(({ theme }) => ({ color: (theme.vars || theme).palette.text.secondary }));

// Detail facts

export const FactRow = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(0.5, 0),
}));

export const LinkLine = styled(Typography)(({ theme }) => ({ marginTop: theme.spacing(0.5) }));

// Forms

export const ColumnsControl = styled(FormControl)({ minWidth: 170 });

export const FileButton = styled(Button)({ height: 56 }) as unknown as typeof Button;

export const FormDialogContent = styled(DialogContent)(({ theme }) => ({ paddingTop: theme.spacing(3) }));

