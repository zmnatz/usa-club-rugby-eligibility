# The eligibility UI is a published package that hosts configure

`packages/usa-club-rugby-components` is published to npm as `@zmnatz/usa-club-rugby-components`, so another app built on `@zmnatz/usa-club-rugby-data` can show the same report. The site is one consumer of it, as with the data package (ADR 003).

Decisions, so they are not "fixed" later:

- **React and MUI, not headless**: the package ships the screens. Logic with no UI, such as `verdictStatus`, belongs in the data package, so an app with its own UI can still use it.
- **Peer dependencies**: React, MUI, Emotion and the data package are peers, so a host has one copy of each and one theme. The live pull is one request per club view, so it doesn't justify a query library as well.
- **No framework**: no Next.js import and no `@/` alias, enforced by `src/boundaries.test.ts`. Relative `.ts`/`.tsx` imports are rewritten at build, as in the data package.
- **Works under any MUI theme**: styling is in the package's primitives and takes spacing and colour from the host's theme. It doesn't rely on the site's theme extensions, and carries no colours, defaults or copy for any club or union.
- **The host owns navigation**: it supplies its Link component and its routes once. The package holds no URL scheme.
- **Hosts choose data sources**: whether to pull live is a prop. The package doesn't read environment variables or know a site's base path.
