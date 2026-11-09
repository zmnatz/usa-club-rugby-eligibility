import { describe, expect, it } from 'bun:test';
import { themeCss } from '@/theme/stylesheet';

describe('site theme', () => {
  it("sets the dark scheme in CSS, so it applies before the page's JavaScript runs", () => {
    expect(themeCss()).toContain('@media (prefers-color-scheme: dark)');
  });
});
