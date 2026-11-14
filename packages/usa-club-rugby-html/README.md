# @zmnatz/usa-club-rugby-html

React components for USA Club Rugby **NCS eligibility** that render plain, semantic HTML styled by one stylesheet: the club directory, a club's eligibility report with a player dialog, player detail, a check of a Rugby Xplorer Match Participation Report, and the list of games whose record still needs entering. They sit on [`@zmnatz/usa-club-rugby-data`](https://www.npmjs.com/package/@zmnatz/usa-club-rugby-data), need no UI framework beyond React, and work with any router. For the same screens in MUI, see [`@zmnatz/usa-club-rugby-components`](https://www.npmjs.com/package/@zmnatz/usa-club-rugby-components).

> A guide, not an official tool. The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## Install

```bash
npm install @zmnatz/usa-club-rugby-html @zmnatz/usa-club-rugby-data react
```

`react` and `@zmnatz/usa-club-rugby-data` are peer dependencies, so your app has one copy of each.

## Set up your app once

Import the stylesheet once, and wrap your app in `EligibilityLinksProvider`, which tells the components how to link to your pages:

```tsx
import '@zmnatz/usa-club-rugby-html/styles.css';
import { EligibilityLinksProvider, type EligibilityRoutes } from '@zmnatz/usa-club-rugby-html';

const routes: EligibilityRoutes = {
  club: (clubKey) => `/club/${clubKey}`,
  player: (playerId) => `/player/${encodeURIComponent(playerId)}`,
  methodology: () => '/methodology',
};

export function App({ children }: { children: React.ReactNode }) {
  return (
    <EligibilityLinksProvider Link="a" routes={routes}>
      {children}
    </EligibilityLinksProvider>
  );
}
```

`Link` is rendered for every internal link and receives `href` and `children`: pass `"a"`, or your router's link if it takes `href`. A route is any function returning a URL, so query strings work. Include any base path your Link doesn't add for you. The club directory is the exception: its links are plain anchors, so a list of hundreds of clubs costs little to hydrate, and its hrefs (`routes.club`, or its `clubHref`) are used as given, so return the URL your server serves, trailing slash and all.

`reportProblem` is optional. Give it and every club report says where to report a verdict that looks wrong: Rugby Xplorer first, then your address. Called with no argument, it returns your general address. For a Locked Season it is called with a `ProblemReport` (`kind`, `season` and, on a club report, `club`). Leave it out and no note shows.

## Styles

Every style is an `ec-` class on `--ec-*` custom properties, with a dark scheme under `prefers-color-scheme`. Override the properties to change the look. The stylesheet sets no page background, font or heading styles; those are your app's.

## Behaviour

A report's tables sort on their header buttons, the directory filters as it is typed in, and Export Report downloads the report as text.

A player's detail opens in a dialog that your URL controls, so the component holds no state for it. Give `ClubEligibilityReport` a `playerHref` (where each name links, such as the report's URL with `?player=<id>`), the `playerId` your URL names, and an `onClose` that goes back to the report's URL without it. Leave them out and names are plain text. For this season's players the dialog links to your `player` route. The status filter is React state, using `filterPlayers` from the data package. The optional columns and the jumps between sides are HTML and CSS (`:has()`, `<details>`, anchors), so they work before the page hydrates.

## Unreported games

`UnreportedGames` lists the games `unreportedGames` (from the data package) finds: no result, or a side with no lineup or no substitutions, past the leeway after kickoff. They are grouped by competition in collapsible sections, with Expand all, Collapse all and a switch to one table. They can be filtered by division, by any part of a competition's name (with suggestions), and by reason. Each reason is a toggle: a game shows when any of its reasons is on, and every game when none is. Each reason has a colour, on its text, its toggle and the cell it marks: the side a gap names, or the date for a missing result.

```tsx
<UnreportedGames games={games} filters={filters} onFiltersChange={setFilters} />
```

`filters` and `onFiltersChange` are optional. Give them to keep the filters yourself, for example in the URL. Leave them out and the list keeps its own, starting from `DEFAULT_UNREPORTED` (games with no lineup).

The report's data logic (columns, sorting, filtering, the export text) is in `@zmnatz/usa-club-rugby-data`, for an app that wants it with its own UI.
