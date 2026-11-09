# @zmnatz/usa-club-rugby-components

React and MUI components for USA Club Rugby **NCS eligibility**: the club directory, a club's eligibility report, player detail, and a check of a Rugby Xplorer Match Participation Report. They sit on [`@zmnatz/usa-club-rugby-data`](https://www.npmjs.com/package/@zmnatz/usa-club-rugby-data), and work under any MUI theme and any router.

> A guide, not an official tool. The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## Install

```bash
npm install @zmnatz/usa-club-rugby-components @zmnatz/usa-club-rugby-data \
  react react-dom @mui/material @emotion/react @emotion/styled
```

These are peer dependencies, so your app has one copy of each and one MUI theme:

| Peer | Used for |
| --- | --- |
| `react`, `react-dom` | Rendering |
| `@mui/material`, `@emotion/react`, `@emotion/styled` | Components and styling |
| `@zmnatz/usa-club-rugby-data` | The rules, data types and CMS client |

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

### The theme

Colours, type and shapes come from your MUI `ThemeProvider`, or from MUI's default theme if there isn't one. No extra theme setup is needed: the layout is on the components, so overriding MUI components in your theme restyles the screens without breaking them.

The club list and skip link have no MUI equivalent: override them as `EligibilityClubList` and `EligibilitySkipLink`.

## Components

### `ClubDirectory`

Every club, filtered as the user types.

```tsx
<ClubDirectory clubs={clubs} autoFocus />
```

Pass `autoFocus` to put the cursor in the filter when the directory appears, on a page that is mainly the directory. Off by default.

Pass `staticFilter` when the host serves the rendered HTML without React. It adds a small script that runs the same filter. Don't pass it on a page that hydrates. Off by default.

### `ClubEligibilityReport`

One club's report from its Match Record, with when the records were last updated.

```tsx
<ClubEligibilityReport club={club} saved={snapshot} fixtures={fixtures} clubSlug="your-club" />
```

| Prop | Purpose |
| --- | --- |
| `club`, `saved`, `fixtures` | From the data package's published client or your own copy of the data |
| `clubSlug` | The club's Rugby Xplorer slug for match links. Without it, links use the council's path. |

### `MatchParticipationReport`

Upload or paste a Match Participation Report, for any club.

```tsx
<MatchParticipationReport loadFixtures={client.fixtures} />
```

`loadFixtures` is called when a report is first run, and verdicts wait for it. Without it, or if it fails, players short of a minimum can't be on track.

### `SkipToFirstPlayer`

A skip link to the first player in the report on the page, for keyboard users. It stays off screen until focused, so render it before anything else on the page that can take focus, such as your site's header.

```tsx
<SkipToFirstPlayer />
```

A client-side route change can leave focus partway down the new page. Pass a `ref` and focus the link when your router arrives on a report, so the link is the next stop.

### Lower-level pieces

`EligibilityReportView` renders a breakdown you've already worked out. `PlayerEligibilityDialog`, `PlayerDetailBody`, `PlayerDetailHeading` and `EligibilityStatusChip` show one player's verdict.
