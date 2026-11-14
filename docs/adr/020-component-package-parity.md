# The two component packages offer the same screens with the same props

The HTML package (ADR 009) moved on with the site: player names became links to the player's page instead of a dialog (ADR 017), every side's table shows at once with links to jump between them, the export is stamped with the record's time, and it gained `Tabs` and `UnreportedGames`. The MUI package (ADR 005) kept the old API, so the two packages, released at one version (`docs/releasing.md`), described different screens.

Decisions, so they are not "fixed" later:

- **Same exports, same props.** Each component either package exports, the other exports too, with the same props and behaviour. Only the markup and styling differ: semantic HTML and `ec-` classes in one, standard MUI components under the host's theme in the other (ADR 005).
- **The MUI package follows the HTML one.** It drops `PlayerEligibilityDialog`, the chip's `onClick`, the directory's `staticFilter`, and the report's `record`, `playerPages`, `clubSlug` and `activeSide`/`onActiveSideChange`; it takes `playerHref`, `recordsUpdated` and `now`, edits a CSV report's data in place, and adds `Tabs` and `UnreportedGames`.
- **Shared logic lives in the data package.** The unreported list's filters, wording and tones (`filterUnreported`, `DEFAULT_UNREPORTED`, `UNREPORTED_REASONS` and the rest) are in `@zmnatz/usa-club-rugby-data`, and both packages re-export the constants their list takes, so the two lists can't filter differently.
- **The tests are the HTML package's where they can be.** The MUI package runs the HTML package's tests for each component, changed only where they read markup that differs (a toggle button instead of a radio, a `Select` instead of checkboxes, an accordion instead of `<details>`). Colours are the theme's, so the MUI list marks each flagged cell's tone with `data-tone` for its tests. Its theme tests stay: the screens render under MUI's default theme and take the host's palette.
- **A change to one package's screen is a change to both.** A pull request that changes a component's props or behaviour in one package changes the other's the same way.
