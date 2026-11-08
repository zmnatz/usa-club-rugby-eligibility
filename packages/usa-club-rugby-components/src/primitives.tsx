import type { ComponentProps, ComponentType } from 'react';
import {
  Alert,
  type AlertProps,
  Autocomplete,
  Button,
  DialogContent,
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

/** Looks like the text inside it, with a focus ring for keyboard users. */
export const PlayerButton = styled('button')(({ theme }) => ({
  padding: 0,
  border: 0,
  background: 'none',
  color: 'inherit',
  font: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  '&:focus-visible': {
    outline: `2px solid ${(theme.vars || theme).palette.primary.main}`,
    outlineOffset: 2,
  },
})) as ComponentType<ComponentProps<'button'>>;

/** Above the top of the page until focused from the keyboard. */
export const SkipLink = styled('a')(({ theme }) => ({
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

export const LinkLine = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(0.5),
})) as ComponentType<TypographyProps>;

// Forms

export const FileButton = styled(Button)({ height: 56 }) as unknown as typeof Button;

export const FormDialogContent = styled(DialogContent)(({ theme }) => ({
  paddingTop: theme.spacing(3),
})) as typeof DialogContent;

export const ClubPicker = styled(Autocomplete)({
  minWidth: 280,
  flex: '1 1 280px',
  maxWidth: 420,
}) as unknown as typeof Autocomplete;

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
