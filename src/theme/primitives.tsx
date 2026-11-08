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
  TextField,
  Typography,
  type TypographyProps,
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

// Text. Standard Typography variants with the colour and spacing each use needs.

const Body2 = (props: TypographyProps) => <Typography variant="body2" {...props} />;
const Body2Inline = (props: TypographyProps) => <Typography variant="body2" component="span" {...props} />;
const H2 = (props: TypographyProps) => <Typography variant="h5" component="h2" {...props} />;
const H3 = (props: TypographyProps) => <Typography variant="h6" component="h3" {...props} />;

/** Secondary small print that ends a block. */
export const Note = styled(Body2)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(0, 0, 2),
}));

/** Secondary small print that follows content. */
export const Aside = styled(Body2)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(2, 0, 0),
}));

/** The paragraph that introduces a page. */
export const Lead = styled(Typography)(({ theme }) => ({
  color: (theme.vars || theme).palette.text.secondary,
  margin: theme.spacing(0, 0, 2),
  maxWidth: 840,
}));

/** Small text with weight. */
export const Emphasis = styled(Body2Inline)(({ theme }) => ({ fontWeight: theme.typography.fontWeightMedium }));

// Prose headings and paragraphs, for the methodology page.

export const SectionHeading = styled(H2)(({ theme }) => ({ margin: theme.spacing(4, 0, '0.35em') }));

export const SubsectionHeading = styled(H3)(({ theme }) => ({ margin: theme.spacing(3, 0, '0.35em') }));

export const Paragraph = styled(Typography)(({ theme }) => ({ margin: theme.spacing(0, 0, 1.5) }));

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

export const FactValue = styled(Emphasis)({ textAlign: 'right' });

export const LinkLine = styled(Typography)(({ theme }) => ({ marginTop: theme.spacing(0.5) }));

// Forms

export const ColumnsControl = styled(FormControl)({ minWidth: 170 });

export const FileButton = styled(Button)({ height: 56 }) as unknown as typeof Button;

export const FormDialogContent = styled(DialogContent)(({ theme }) => ({ paddingTop: theme.spacing(3) }));

export const SearchField = styled(TextField)({ minWidth: 260, flex: '1 1 260px', maxWidth: 420 });

// Club directory

export const ClubList = styled('ul')(({ theme }) => ({
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: '1fr',
  columnGap: theme.spacing(3),
  [theme.breakpoints.up('sm')]: { gridTemplateColumns: '1fr 1fr' },
  [theme.breakpoints.up('md')]: { gridTemplateColumns: '1fr 1fr 1fr' },
}));

export const ClubItem = styled('li')(({ theme }) => ({
  borderBottom: `1px solid ${(theme.vars || theme).palette.divider}`,
}));

export const ClubLink = styled(Link)(({ theme }) => ({ display: 'block', padding: theme.spacing(1, 0) })) as typeof Link;

export const SideLabels = styled(Typography)(({ theme }) => ({ marginLeft: theme.spacing(1) })) as typeof Typography;

export const EmptyNote = styled(Typography)(({ theme }) => ({ padding: theme.spacing(2, 0) }));
