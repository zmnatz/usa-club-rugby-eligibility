# The eligibility UI is a published package that hosts configure

`packages/usa-club-rugby-components` is published to npm as `@zmnatz/usa-club-rugby-components`, so another app built on `@zmnatz/usa-club-rugby-data` can show the same report. The site is one consumer of it, as with the data package (ADR 003).

Decisions, so they are not "fixed" later:

- **React and MUI, not headless**: the package ships the screens. Logic with no UI, such as `verdictStatus`, belongs in the data package, so an app with its own UI can still use it.
- **Peer dependencies**: React, MUI, Emotion and the data package are peers, so a host has one copy of each and one theme. TanStack Query isn't one: the live pull only runs when a visitor asks, from a click handler.
- **No framework**: no Next.js import and no `@/` alias, enforced by `src/boundaries.test.ts`. Relative `.ts`/`.tsx` imports are rewritten at build, as in the data package.
- **Styled through the host's MUI theme**: the package uses standard MUI components with standard props, so a host restyles it the way it restyles MUI. Its layout is exported as `eligibilityComponents`, overrides of those components that a host adds to its theme and can replace one by one. A host that leaves it out loses the spacing, which is the cost of having no bespoke wrappers. Only elements MUI has no component for stay styled in the package, under their own theme names. It carries no colours, defaults or copy for any club or union.
- **The host owns navigation**: it supplies its Link component and its routes once. The package holds no URL scheme.
- **Hosts choose data sources**: whether to offer a visitor a live pull is a prop. It's a button rather than automatic, because the nightly data is mostly current and each pull costs CMS requests. The package doesn't read environment variables or know a site's base path.
