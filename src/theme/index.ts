import { createTheme } from '@mui/material/styles';
import { eligibilityComponents } from '@zmnatz/usa-club-rugby-components';

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
// Common styling lives here, on standard MUI components. `sx` is only for one-offs.

export const theme = createTheme({
  // The static HTML carries both schemes behind prefers-color-scheme, so the browser
  // picks the visitor's before any JavaScript runs and there's no light flash.
  cssVariables: { colorSchemeSelector: 'media' },
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1f4e8c' } },
  typography: { h4: { fontWeight: 600 } },
  components: {
    ...eligibilityComponents,
    MuiCssBaseline: {
      styleOverrides: {
        '#__next': { display: 'flex', flexDirection: 'column', minHeight: '100dvh' },
        pre: { overflowX: 'auto' },
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: ({ theme }) => ({ paddingTop: theme.spacing(3), paddingBottom: theme.spacing(3), flexGrow: 1 }),
      },
    },
    MuiTypography: {
      variants: [
        {
          props: { component: 'footer' },
          style: ({ theme }) => ({ padding: theme.spacing(3, 0) }),
        },
        // Secondary small print that ends a block.
        {
          props: { variant: 'body2', gutterBottom: true },
          style: ({ theme }) => ({ marginBottom: theme.spacing(2) }),
        },
        // Prose paragraphs.
        {
          props: { variant: 'body1', gutterBottom: true },
          style: ({ theme }) => ({ marginBottom: theme.spacing(1.5) }),
        },
        // The paragraph that introduces a page.
        {
          props: { variant: 'body1', gutterBottom: true, color: 'textSecondary' },
          style: ({ theme }) => ({ marginBottom: theme.spacing(2), maxWidth: 840 }),
        },
        // Prose headings.
        {
          props: { variant: 'h5', gutterBottom: true },
          style: ({ theme }) => ({ marginTop: theme.spacing(4) }),
        },
        {
          props: { variant: 'h6', gutterBottom: true },
          style: ({ theme }) => ({ marginTop: theme.spacing(3) }),
        },
        // Small text with weight.
        {
          props: { variant: 'body2', component: 'strong' },
          style: ({ theme }) => ({ fontWeight: theme.typography.fontWeightMedium }),
        },
      ],
    },
    MuiBreadcrumbs: { styleOverrides: { root: ({ theme }) => ({ marginBottom: theme.spacing(2) }) } },
    MuiToolbar: {
      ...eligibilityComponents.MuiToolbar,
      styleOverrides: {
        // The app bar: its first item, the brand link, pushes the rest to the right.
        root: ({ theme, ownerState }) =>
          ownerState.variant === 'regular'
            ? { gap: theme.spacing(2), flexWrap: 'wrap', '& > :first-child': { flexGrow: 1 } }
            : {},
      },
    },
  },
});
