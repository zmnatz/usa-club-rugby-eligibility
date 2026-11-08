# @zmnatz/usa-club-rugby-components

React and MUI components for USA Club Rugby **NCS eligibility**: the club directory, a club's eligibility report, player detail, and a check of a Rugby Xplorer Match Participation Report. They sit on [`@zmnatz/usa-club-rugby-data`](https://www.npmjs.com/package/@zmnatz/usa-club-rugby-data), and work under any MUI theme and any router.

> A guide, not an official tool. The Rugby Xplorer Match Participation Report is the official count, and registration isn't checked.

## Install

```bash
npm install @zmnatz/usa-club-rugby-components @zmnatz/usa-club-rugby-data \
  react react-dom @mui/material @emotion/react @emotion/styled @tanstack/react-query
```

These are peer dependencies, so your app has one copy of each and one MUI theme:

| Peer | Used for |
| --- | --- |
| `react`, `react-dom` | Rendering |
| `@mui/material`, `@emotion/react`, `@emotion/styled` | Components and styling |
| `@tanstack/react-query` | Loading and refreshing a club's Match Record |
| `@zmnatz/usa-club-rugby-data` | The rules, data types and CMS client |

## Set up your app once

Wrap your app in two providers. `EligibilityLinksProvider` tells the components how to link to your pages, and TanStack Query's `QueryClientProvider` is needed by `ClubEligibilityReport`.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EligibilityLinksProvider, type EligibilityRoutes } from '@zmnatz/usa-club-rugby-components';
import { Link } from 'your-router';

const queryClient = new QueryClient();

const routes: EligibilityRoutes = {
  club: (clubKey) => `/club/${clubKey}`,
  player: (playerId) => `/player/${encodeURIComponent(playerId)}`,
  methodology: () => '/methodology',
};

export function App({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <EligibilityLinksProvider Link={Link} routes={routes}>
        {children}
      </EligibilityLinksProvider>
    </QueryClientProvider>
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

Components take their colours and spacing from your MUI `ThemeProvider`, or from MUI's default theme if there isn't one. No extra theme setup is needed.

## Components

### `ClubDirectory`

Every club, filtered as the user types.

```tsx
<ClubDirectory clubs={clubs} />
```

### `ClubEligibilityReport`

One club's report from its Match Record. The saved data shows straight away.

```tsx
<ClubEligibilityReport club={club} saved={snapshot} fixtures={fixtures} live clubSlug="your-club" />
```

| Prop | Purpose |
| --- | --- |
| `club`, `saved`, `fixtures` | From the data package's published client or your own copy of the data |
| `live` | Replace the saved data with a pull from the CMS when it lands. Off by default. |
| `clubSlug` | The club's Rugby Xplorer slug for match links. Without it, links use the council's path. |

### `MatchParticipationReport`

Upload or paste a Match Participation Report, for any club.

```tsx
<MatchParticipationReport fixtures={fixtures} />
```

Leave `fixtures` undefined until they load. Players short of a minimum can only be on track once the fixtures are known.

### Lower-level pieces

`EligibilityReportView` renders a breakdown you've already worked out. `PlayerEligibilityDialog`, `PlayerDetailBody`, `PlayerDetailHeading` and `EligibilityStatusChip` show one player's verdict.
