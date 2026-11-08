import { createTheme } from '@mui/material/styles';

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
// All styling lives here (the theme) or in ./primitives; components don't use `sx`.

export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1f4e8c' } },
  typography: { h4: { fontWeight: 600 } },
  components: {
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
