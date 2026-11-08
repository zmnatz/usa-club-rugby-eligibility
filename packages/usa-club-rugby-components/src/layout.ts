// Layout shared by the screens, as `sx` for standard components. It is here rather
// than in a theme so the screens are laid out under any theme, MUI's default included.

/** A row of controls that wraps on a narrow screen. */
export const wrapRow = { flexWrap: 'wrap', alignItems: 'center' } as const;

/** The same, with its first and last items at opposite ends. */
export const spreadRow = { ...wrapRow, justifyContent: 'space-between' } as const;
