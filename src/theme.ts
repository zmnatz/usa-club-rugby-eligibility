import { createTheme } from '@mui/material';

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1f4e8c' } },
  typography: { h4: { fontWeight: 600 } },
});
