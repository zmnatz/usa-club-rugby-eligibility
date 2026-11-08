import type { ComponentProps, ComponentType } from 'react';
import {
  Alert,
  type AlertProps,
  FormControl,
  Link,
  Paper,
  type PaperProps,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
  type TypographyProps,
} from '@mui/material';
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

/** A block with theme-spaced margins. */
export const Block = styled('div', { shouldForwardProp: notForwarded('above', 'below') })<{
  above?: number;
  below?: number;
}>(({ theme, above = 0, below = 0 }) => ({
  marginTop: theme.spacing(above),
  marginBottom: theme.spacing(below),
})) as ComponentType<ComponentProps<'div'> & { above?: number; below?: number }>;

/** Something shown in place of a value. */
export const Dim = styled('span')(({ theme }) => ({
  color: (theme.vars || theme).palette.text.disabled,
})) as ComponentType<ComponentProps<'span'>>;

// Text

const Body2 = (props: TypographyProps) => <Typography variant="body2" {...props} />;
const Body2Inline = (props: TypographyProps) => <Typography variant="body2" component="span" {...props} />;

/** Secondary small print that ends a block. */
export const Note = styled(Body2)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(0, 0, 2),
})) as ComponentType<TypographyProps>;

/** Secondary small print that follows content. */
export const Aside = styled(Body2)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(2, 0, 0),
})) as ComponentType<TypographyProps>;

/** The paragraph that introduces a page. */
export const Lead = styled(Typography)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(0, 0, 2),
  maxWidth: 840,
})) as ComponentType<TypographyProps>;

/** Small text with weight. */
export const Emphasis = styled(Body2Inline)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightMedium,
})) as ComponentType<TypographyProps>;

export const ReportAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(3),
})) as ComponentType<AlertProps>;

export const PlainList = styled('ul')(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
})) as ComponentType<ComponentProps<'ul'>>;

export const ColumnsControl = styled(FormControl)({ minWidth: 170 }) as typeof FormControl;

// Tables

export const ClickableRow = styled(TableRow)({ cursor: 'pointer' }) as typeof TableRow;

export const BoldCell = styled(TableCell)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
})) as typeof TableCell;

export const RoundsTable = styled(TableContainer)(({ theme }) => ({
  marginTop: theme.spacing(1),
})) as typeof TableContainer;

export const NoWrapCell = styled(TableCell)({ whiteSpace: 'nowrap' }) as typeof TableCell;

export const EmptyCell = styled(TableCell)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
})) as typeof TableCell;

// Detail facts

export const FactRow = styled('div')(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  padding: theme.spacing(0.5, 0),
})) as ComponentType<ComponentProps<'div'>>;

export const FactValue = styled(Emphasis)({ textAlign: 'right' }) as ComponentType<TypographyProps>;

export const LinkLine = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
})) as ComponentType<TypographyProps>;

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
