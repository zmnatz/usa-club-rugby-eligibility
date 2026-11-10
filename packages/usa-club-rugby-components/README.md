# @zmnatz/usa-club-rugby-components

React components for USA Club Rugby **NCS eligibility**: the club directory, a club's eligibility report, player detail, and a check of a Rugby Xplorer Match Participation Report. They render plain HTML, styled by one small stylesheet, with no UI framework and no required client-side JavaScript. They sit on [`@zmnatz/usa-club-rugby-data`](https://www.npmjs.com/package/@zmnatz/usa-club-rugby-data), and work with any router.

> A guide, not an official tool. The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## Install

```bash
npm install @zmnatz/usa-club-rugby-components @zmnatz/usa-club-rugby-data react react-dom
```

These are peer dependencies, so your app has one copy of each:

| Peer | Used for |
| --- | --- |
| `react`, `react-dom` | Rendering (on the server, in the browser, or at build time) |
| `@zmnatz/usa-club-rugby-data` | The rules, data types and CMS client |

Import the stylesheet once, and include the page script once (see below):

```tsx
import '@zmnatz/usa-club-rugby-components/styles.css';
```

## Set up your app once

Wrap your app in `EligibilityLinksProvider`, which tells the components how to link to your pages.

```tsx
import { EligibilityLinksProvider, type EligibilityRoutes } from '@zmnatz/usa-club-rugby-components';
import { Link } from 'your-router';

const routes: EligibilityRoutes = {
  club: (clubKey) => `/club/${clubKey}`,
  player: (playerId) => `/player/${encodeURIComponent(playerId)}`,
  methodology: () => '/methodology',
};

export function App({ children }: { children: React.ReactNode }) {
  return (
    <EligibilityLinksProvider Link={Link} routes={routes}>
      {children}
    </EligibilityLinksProvider>
  );
}
```

### The Link and routes

`Link` is rendered for every internal link and receives `href` and `children`. Use your router's link, as long as it takes `href`. With no router, pass `Link="a"`. If your router's link takes another prop, such as `to`, wrap it:

```tsx
const AppLink = ({ href, ...props }: { href: string }) => <RouterLink to={href} {...props} />;
```

A route is any function returning a URL, so query strings work: `player: (id) => `/player?id=${encodeURIComponent(id)}``. Include any base path your Link doesn't add for you.

`reportProblem` is optional. Give it and every club report tells people where to report a verdict that looks wrong: Rugby Xplorer first, then your address. Called with no argument, it returns your general address, such as an issue tracker. For a Locked Season it is called with a `ProblemReport` (`kind`, `season` and, on a club report, `club`), so you can open a new report filled in with them. `kind` is `rules-engine` when the record is right but a verdict looks wrong, or `archive-correction` when the season's archived record is wrong. Leave it out and no note shows.

### The stylesheet

`styles.css` is plain CSS. Every class starts with `ec-`, and the colours, radius and spacing are variables on `:root`, with a dark scheme under `prefers-color-scheme`. Retheme by overriding them:

```css
:root {
  --ec-primary: #7a1f1f;
  --ec-radius: 2px;
}
```

The variables are `--ec-primary`, `--ec-on-primary`, `--ec-fg`, `--ec-muted`, `--ec-bg`, `--ec-surface`, `--ec-border`, `--ec-hover`, `--ec-error`, `--ec-warning`, `--ec-success`, `--ec-info` (and a `-bg` for each of the last four), `--ec-radius` and `--ec-gap`. The package sets no page background, font or heading styles: those are yours.

### The page script

Three things need a little JavaScript: sorting a table by a column, filtering the club directory as you type, and downloading the exported report. They share one script, a string you put once at the end of `<body>` on any page that shows a report or directory. It listens on `document`, so it also works for markup React adds later, and is safe to include twice.

```tsx
import { ENHANCEMENT_SCRIPT } from '@zmnatz/usa-club-rugby-components';

<script dangerouslySetInnerHTML={{ __html: ENHANCEMENT_SCRIPT }} />
```

Without it everything still shows: the tables are complete and in name order, the directory lists every club, and the status filter, optional columns and jump links between sides work with CSS alone. Only the three things above stop.

Everything else is HTML: a report page can be rendered on the server or at build time and shipped with no React in the browser.

## Components

### `ClubDirectory`

Every club, as links, with a filter that hides the ones that don't match as the user types (run by the page script).

```tsx
<ClubDirectory clubs={clubs} autoFocus />
```

Pass `autoFocus` to put the cursor in the filter when the directory appears, on a page that is mainly the directory. Off by default.

### `ClubEligibilityReport`

One club's report from its Match Record, with when the records were last updated. Each side has its own table of players, each player linked to the host's player route, with a status filter and optional columns that need no script. The Export Report button downloads a text report that is written into the page.

```tsx
<ClubEligibilityReport club={club} saved={snapshot} fixtures={fixtures} />
```

| Prop | Purpose |
| --- | --- |
| `club`, `saved`, `fixtures` | From the data package's published client or your own copy of the data |

### `MatchParticipationReport`

Upload or paste a Match Participation Report, for any club.

```tsx
<MatchParticipationReport loadFixtures={client.fixtures} />
```

`loadFixtures` is called when a report is first run, and verdicts wait for it. Without it, or if it fails, players short of a minimum can't be on track.

### `SkipToFirstPlayer`

A skip link to the first player in the report on the page, for keyboard users. It is a plain link to the first row, so it needs no script, and stays off screen until focused. Render it before anything else on the page that can take focus, such as your site's header.

```tsx
<SkipToFirstPlayer />
```

A client-side route change can leave focus partway down the new page. Focus the link when your router arrives on a report, so it is the next stop.

### `ReportProblemNote`

Where to report a problem, for a page of your own about a season, such as a list of a Locked Season's clubs. Club reports already include it. It shows only when your routes have `reportProblem`.

```tsx
<ReportProblemNote season="2024/2025" locked />
```

### Lower-level pieces

`EligibilityReportView` renders a breakdown you've already worked out. `PlayerDetailBody`, `PlayerDetailHeading` and `EligibilityStatusChip` show one player's verdict, as on a player's page of your own.

### Changes from 0.8

0.9 drops MUI and Emotion. Remove them as peers if nothing else uses them, import `styles.css` and add the page script. `PlayerEligibilityDialog` is gone, and a report's players link to the host's player route instead of opening a dialog. `ClubEligibilityReport` no longer takes `clubSlug`, and `EligibilityReportView` no longer takes `record`, `clubSlug`, `activeSide` or `onActiveSideChange`. `ClubDirectory` no longer takes `staticFilter`, and the `EligibilityClubList` and `EligibilitySkipLink` theme overrides are replaced by CSS. `SkipToFirstPlayer` takes no `ref`.
