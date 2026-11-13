import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EligibilityLinksProvider } from './links.tsx';
import { Tabs } from './Tabs.tsx';

const routes = { club: (key: string) => `/club/${key}`, player: (id: string) => `/player/${id}`, methodology: () => '/methodology' };

const render = (selected: string) =>
  renderToStaticMarkup(
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
    const html = render('2024-25');

    expect(html).toContain('role="tablist" aria-label="Season"');
    expect(html).toContain('href="?season=current" role="tab" id="ec-tab-current" aria-selected="false"');
    expect(html).toContain('href="?season=2024-25" role="tab" id="ec-tab-2024-25" aria-selected="true"');
  });

  it('labels the panel by the open tab', () => {
    expect(render('current')).toContain('role="tabpanel" aria-labelledby="ec-tab-current"><p>panel</p>');
  });
});
