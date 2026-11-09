import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  // Types the ThemeProvider props that only apply to a CSS-variables theme.
  interface CssThemeVariables {
    enabled: true;
  }
}

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
// The theme sets the look. Layout is on the components, so they work without it.

export const theme = createTheme({
  // theme.css carries both schemes behind prefers-color-scheme, so the browser picks
  // the visitor's before any JavaScript runs and there's no light flash.
  cssVariables: { colorSchemeSelector: 'media' },
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
    MuiBreadcrumbs: { styleOverrides: { root: ({ theme }) => ({ marginBottom: theme.spacing(2) }) } },
  },
});
