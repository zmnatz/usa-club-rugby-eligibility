# The site's screens are plain HTML and CSS

> The script, the export in the page, the ban on a player dialog and the pages without React are superseded by ADR 010. The rest stands.

The site used MUI and Emotion, through the component package. Every page carried MUI's runtime, Emotion's, React's hydration of a table of hundreds of cells, and a theme's worth of CSS variables, to show text, links and tables from data that is fixed at build time. The site is static, so this cost every visitor on every page for nothing they could see.

Decisions, so they are not "fixed" later:

- **The plain components are their own package, beside the MUI one.** The screens are in `packages/usa-club-rugby-html`, published as `@zmnatz/usa-club-rugby-html`, a plain HTML version of the MUI package's screens. The MUI package (`@zmnatz/usa-club-rugby-components`, ADR 005) stays React and MUI, because it is published on its own schedule, so a rewrite of it can't land with the site's change. The HTML package keeps the MUI package's rules: no Next.js imports, `@/` aliases, environment variables or route strings (`boundaries.test.ts`). They began in the site as `src/eligibility/` and moved to a package once they settled.
- **Both component packages hold only components.** The report's columns, sorting, filtering, export text and date formatting have no UI, so they are in the data package (`reportModel.ts`, `sort.ts`, `dates.ts`), shared by both, as ADR 005 has it for `verdictStatus`.
- **Semantic HTML and one stylesheet.** The package's `styles.css` (imported as `@zmnatz/usa-club-rugby-html/styles.css`) holds every style, as `ec-` classes on `--ec-*` custom properties, with a dark scheme under `prefers-color-scheme`. It sets no page background, font or heading styles. The site's own chrome and prose are in `src/styles/site.css`, on the same variables.
- **CSS does what CSS can.** A club's sides are all on the page, with in-page links between them, rather than tabs. The status filter is radio buttons and `:has()`, the optional columns are checkboxes in a `<details>`, and the skip link is an anchor to a focusable row. None of these need a script. `:has()` is in every current browser; in one without it the filter and column choice do nothing and every row and column is shown, which is a safe failure.
- **~~One script, listening on `document`~~** (superseded by ADR 010). It sorted the tables, filtered the club directory and downloaded the export on pages without React.
- **~~The export text is in the page~~** (superseded by ADR 010). The report's text was rendered into a `<template>` for the script to download.
- **~~No player dialog~~** (superseded by ADR 010). A current-season name linked to the player's page; a Locked Season's and a CSV report's players showed only the table.
- **~~No React in the browser where it isn't needed~~** (superseded by ADR 010). Every page but the Locked Season page and the CSV report shipped no Next runtime (`unstable_runtimeJS: false`), with an inline script to reload on history navigation. The 404 page still works this way: its redirect of `/player/?id=` links is an inline script, built from the tested `queryPlayerId` and `playerPath`.
