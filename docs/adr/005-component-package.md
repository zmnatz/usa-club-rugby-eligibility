# The eligibility UI is a published package that hosts configure

`packages/usa-club-rugby-components` is published to npm as `@zmnatz/usa-club-rugby-components`, so another app built on `@zmnatz/usa-club-rugby-data` can show the same report. The site is one consumer of it, as with the data package (ADR 003).

Decisions, so they are not "fixed" later:

- **React and MUI, not headless**: the package ships the screens. Logic with no UI, such as `verdictStatus`, belongs in the data package, so an app with its own UI can still use it.
- **Peer dependencies**: React, MUI, Emotion and the data package are peers, so a host has one copy of each and one theme.
- **No framework**: no Next.js import and no `@/` alias, enforced by `src/boundaries.test.ts`. Relative `.ts`/`.tsx` imports are rewritten at build, as in the data package.
- **Works under any MUI theme, including MUI's default**: the package uses standard MUI components, and layout is on them as props and `sx`: `Stack` for spacing, `Card` for padded surfaces. A theme changes only the look, so a host needs no setup and can't lose the layout by leaving something out. The two elements MUI has no component for stay styled in the package, under their own theme names. It doesn't rely on the site's theme extensions, and carries no colours, defaults or copy for any club or union.
- **The host owns navigation**: it supplies its Link component and its routes once. The package holds no URL scheme.
- **Hosts supply the data**: the report shows the Match Record it's given and makes no CMS requests. The CSV report takes a `loadFixtures` function and calls it when a report is first run, so visitors who never run one don't download the fixture list. The package doesn't read environment variables or know a site's base path.
