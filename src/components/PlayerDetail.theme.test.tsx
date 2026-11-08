import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { EligibilityLinksProvider, PlayerDetailBody } from '@zmnatz/usa-club-rugby-components';
import type { PlayerEligibility } from '@zmnatz/usa-club-rugby-data';
import { theme } from '@/theme';
import { routes } from '@/utils/paths';

const player: PlayerEligibility = {
  playerId: 'cal',
  firstName: 'Cal',
  lastName: 'Careful',
  name: 'Cal Careful',
  lastRegistered: '',
  teamName: 'Harbor City MD3',
  played: 3,
  substitute: 0,
  participation: 3,
  otherSides: [],
  eligible: true,
  reasons: [],
  pending: [],
  cautions: ['One more D1 match (3 played)'],
  rows: [],
};

describe("player detail under the site's theme", () => {
  it('renders the verdict and facts', () => {
    render(
      <ThemeProvider theme={theme}>
        <EligibilityLinksProvider Link="a" routes={routes}>
          <PlayerDetailBody player={player} source="record" ownLabel="D3" fixtures={null} />
        </EligibilityLinksProvider>
      </ThemeProvider>,
    );
    expect(screen.getByText(/One more D1 match/)).toBeTruthy();
    expect(screen.getByText('D3 side')).toBeTruthy();
  });
});
