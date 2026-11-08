import { describe, expect, it } from 'bun:test';
import type { CssVarsTheme } from '@mui/material/styles';
import { eligibilityComponents } from '@zmnatz/usa-club-rugby-components';
import { theme } from '@/theme';

describe('site theme', () => {
  it("includes the component package's styles", () => {
    for (const name of Object.keys(eligibilityComponents)) {
      expect(Object.keys(theme.components ?? {})).toContain(name);
    }
  });

  it("sets the dark scheme in CSS, so it applies before the page's JavaScript runs", () => {
    const sheets = JSON.stringify((theme as unknown as CssVarsTheme).generateStyleSheets());
    expect(sheets).toContain('@media (prefers-color-scheme: dark)');
  });
});
