import { createTheme } from '@mui/material/styles';

// Neutral on purpose: this tool serves every club, so it carries no club's colours.
// All styling lives here (the theme) or in ./primitives; components don't use `sx`.

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    /** Secondary small print that ends a block. */
    note: true;
    /** Secondary small print that follows content. */
    aside: true;
    /** The paragraph that introduces a page. */
    lead: true;
    /** Small text with weight. */
    emphasis: true;
    /** Prose headings and paragraphs, for the methodology page. */
    section: true;
    subsection: true;
    paragraph: true;
  }
}

export const theme = createTheme({
  colorSchemes: { light: true, dark: true },
  palette: { primary: { main: '#1f4e8c' } },
  typography: { h4: { fontWeight: 600 } },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: {
          note: 'p',
          aside: 'p',
          lead: 'p',
          emphasis: 'span',
          section: 'h2',
          subsection: 'h3',
          paragraph: 'p',
        },
      },
      variants: [
        {
          props: { variant: 'note' },
          style: ({ theme }) => ({
            ...theme.typography.body2,
            color: (theme.vars || theme).palette.text.secondary,
            margin: theme.spacing(0, 0, 2),
          }),
        },
        {
          props: { variant: 'aside' },
          style: ({ theme }) => ({
            ...theme.typography.body2,
            color: (theme.vars || theme).palette.text.secondary,
            margin: theme.spacing(2, 0, 0),
          }),
        },
        {
          props: { variant: 'lead' },
          style: ({ theme }) => ({
            ...theme.typography.body1,
            color: (theme.vars || theme).palette.text.secondary,
            margin: theme.spacing(0, 0, 2),
            maxWidth: 840,
          }),
        },
        {
          props: { variant: 'emphasis' },
          style: ({ theme }) => ({ ...theme.typography.body2, fontWeight: theme.typography.fontWeightMedium }),
        },
        {
          props: { variant: 'section' },
          style: ({ theme }) => ({ ...theme.typography.h5, margin: theme.spacing(4, 0, '0.35em') }),
        },
        {
          props: { variant: 'subsection' },
          style: ({ theme }) => ({ ...theme.typography.h6, margin: theme.spacing(3, 0, '0.35em') }),
        },
        {
          props: { variant: 'paragraph' },
          style: ({ theme }) => ({ ...theme.typography.body1, margin: theme.spacing(0, 0, 1.5) }),
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
