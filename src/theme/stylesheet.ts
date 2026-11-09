import { writeFileSync } from 'node:fs';
import type { CssVarsTheme } from '@mui/material/styles';
import { theme } from './index';

// Writes the theme's CSS variables to theme.css, which _app imports; `dev` and `build`
// run this first. They're about 22 KB and the same on every page, so they belong in one
// file the browser caches, not inlined into each of the site's thousands of pages.

type Rules = { [selectorOrProperty: string]: string | number | Rules };

const property = (name: string) =>
  name.startsWith('--') ? name : name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function serialize(rules: Rules, indent = ''): string {
  return Object.entries(rules)
    .map(([key, value]) =>
      typeof value === 'object'
        ? `${indent}${key} {\n${serialize(value, `${indent}  `)}\n${indent}}`
        : `${indent}${property(key)}: ${value};`,
    )
    .join('\n');
}

/** The CSS MUI would otherwise inject into every page. */
export function themeCss(): string {
  const sheets = (theme as unknown as CssVarsTheme).generateStyleSheets() as Rules[];
  return `${sheets.map((sheet) => serialize(sheet)).join('\n')}\n`;
}

if (import.meta.main) writeFileSync(new URL('./theme.css', import.meta.url), themeCss());
