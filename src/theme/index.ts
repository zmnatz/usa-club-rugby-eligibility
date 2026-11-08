import { createTheme } from '@mui/material/styles';

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
// All styling lives here (the theme) or in ./primitives; components don't use `sx`.

export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1f4e8c' } },
  typography: { h4: { fontWeight: 600 } },
  components: {
    MuiTypography: {
      variants: [
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
    MuiAlert: { styleOverrides: { root: ({ theme }) => ({ marginBottom: theme.spacing(3) }) } },
    MuiBreadcrumbs: { styleOverrides: { root: ({ theme }) => ({ marginBottom: theme.spacing(2) }) } },
    MuiToolbar: {
      styleOverrides: { root: ({ theme }) => ({ gap: theme.spacing(2), flexWrap: 'wrap' }) },
    },
    MuiAutocomplete: {
      styleOverrides: { root: { minWidth: 280, flex: '1 1 280px', maxWidth: 420 } },
    },
  },
});

export * from './primitives';
