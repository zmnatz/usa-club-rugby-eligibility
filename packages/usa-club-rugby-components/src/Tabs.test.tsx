import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { EligibilityLinksProvider } from './links.tsx';
import { Tabs } from './Tabs.tsx';

const routes = { club: (key: string) => `/club/${key}`, player: (id: string) => `/player/${id}`, methodology: () => '/methodology' };

const renderTabs = (selected: string) =>
  render(
    <EligibilityLinksProvider Link="a" routes={routes}>
      <Tabs
        label="Season"
        selected={selected}
        tabs={[
          { key: 'current', label: '2025/2026', href: '?season=current' },
          { key: '2024-25', label: '2024/2025', href: '?season=2024-25' },
        ]}
      >
        <p>panel</p>
      </Tabs>
    </EligibilityLinksProvider>,
  );

describe('Tabs', () => {
  it('links each tab and marks the open one', () => {
    renderTabs('2024-25');
    expect(screen.getByRole('tablist', { name: 'Season' })).toBeTruthy();
    const current = screen.getByRole('tab', { name: '2025/2026' });
    const past = screen.getByRole('tab', { name: '2024/2025' });
    expect([current.getAttribute('href'), current.getAttribute('aria-selected')]).toEqual(['?season=current', 'false']);
    expect([past.getAttribute('href'), past.getAttribute('aria-selected')]).toEqual(['?season=2024-25', 'true']);
  });

  it('labels the panel by the open tab', () => {
    renderTabs('current');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('ec-tab-current');
    expect(panel.textContent).toBe('panel');
  });
});
