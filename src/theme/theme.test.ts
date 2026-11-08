import { describe, expect, it } from 'bun:test';
import type { CssVarsTheme } from '@mui/material/styles';
import { theme } from '@/theme';

describe('site theme', () => {
  it("sets the dark scheme in CSS, so it applies before the page's JavaScript runs", () => {
    const sheets = JSON.stringify((theme as unknown as CssVarsTheme).generateStyleSheets());
    expect(sheets).toContain('@media (prefers-color-scheme: dark)');
  });
});
