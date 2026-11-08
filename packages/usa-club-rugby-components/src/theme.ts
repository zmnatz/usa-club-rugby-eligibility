import type { CSSObject } from '@emotion/react';
import type { Components, Theme } from '@mui/material/styles';

declare module '@mui/material/Toolbar' {
  interface ToolbarPropsVariantOverrides {
    /** A row of controls with space below it. */
    block: true;
    /** The same, with its first and last items at opposite ends. */
    spread: true;
  }
}

type NamedOverrides = { styleOverrides?: { root?: CSSObject | ((args: { theme: Theme }) => CSSObject) } };

declare module '@mui/material/styles' {
  interface Components<Theme = unknown> {
    EligibilityClubList?: NamedOverrides;
    EligibilitySkipLink?: NamedOverrides;
  }
}

const controlRow = ({ theme }: { theme: Omit<Theme, 'components'> }) => ({
  flexWrap: 'wrap' as const,
  gap: theme.spacing(2),
  minHeight: 0,
  paddingLeft: 0,
  paddingRight: 0,
  // Toolbar sets wider gutters at this breakpoint, which the two above don't reach.
  [theme.breakpoints.up('sm')]: { paddingLeft: 0, paddingRight: 0, minHeight: 0 },
  marginBottom: theme.spacing(2),
});

const fieldWidth = { minWidth: 260, flex: '1 1 260px', maxWidth: 420 };

/** The package's layout, as overrides of standard MUI components. Add them to your
 *  theme, then put your own after them to change any: last one wins. */
export const eligibilityComponents: Components<Omit<Theme, 'components'>> = {
  MuiAlert: {
    styleOverrides: {
      root: ({ theme }) => ({ marginBottom: theme.spacing(3) }),
      message: ({ theme }) => ({ '& ul': { margin: 0, paddingLeft: theme.spacing(2.5) } }),
    },
  },
  MuiAutocomplete: { variants: [{ props: { fullWidth: false }, style: fieldWidth }] },
  MuiFormControl: { variants: [{ props: { size: 'small' }, style: { minWidth: 170 } }] },
  MuiPaper: {
    variants: [
      {
        props: { component: 'section' } as object,
        style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({ padding: theme.spacing(2) }),
      },
    ],
  },
  MuiStack: {
    defaultProps: { useFlexGap: true },
    variants: [{ props: { direction: 'row' }, style: { flexWrap: 'wrap', alignItems: 'center' } }],
  },
  MuiTableContainer: {
    variants: [
      {
        props: { variant: 'outlined' } as object,
        style: ({ theme }: { theme: Omit<Theme, 'components'> }) => ({ marginTop: theme.spacing(1) }),
      },
    ],
  },
  MuiTableRow: { variants: [{ props: { hover: true }, style: { cursor: 'pointer' } }] },
  MuiTextField: { variants: [{ props: { fullWidth: false }, style: fieldWidth }] },
  MuiToolbar: {
    variants: [
      { props: { variant: 'block' }, style: controlRow },
      { props: { variant: 'spread' }, style: (args) => ({ ...controlRow(args), justifyContent: 'space-between' }) },
    ],
  },
};
