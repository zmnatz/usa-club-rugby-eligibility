import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = import.meta.dir;

const sourceFiles = (readdirSync(SOURCE, { recursive: true }) as string[])
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.startsWith('__fixtures__'))
  .map((file) => ({ file, text: readFileSync(join(SOURCE, file), 'utf8') }));

/** The package names and paths a file imports or re-exports. */
const importsIn = (text: string) =>
  [...text.matchAll(/(?:from\s+|import\s*\(?\s*|require\(\s*)['"]([^'"]+)['"]/g)].map((match) => match[1]);

describe('package boundaries', () => {
  it('has source files to check', () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  it('finds imports in every form', () => {
    expect(importsIn(`import a from 'a';\nexport { b } from "b";\nconst c = import('c');\nrequire('d');\nimport 'e';`)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it.each(sourceFiles.map(({ file, text }) => [file, text]))('%s has no Next.js import or @/ alias', (_, text) => {
    const forbidden = importsIn(text).filter(
      (name) => name === 'next' || name.startsWith('next/') || name.startsWith('@next/') || name.startsWith('@/'),
    );
    expect(forbidden).toEqual([]);
  });

  it.each(sourceFiles.map(({ file, text }) => [file, text]))('%s holds no route strings', (_, text) => {
    expect(text.match(/['"`]\/(?:club|player|methodology)\b[^'"`]*/g) ?? []).toEqual([]);
  });
});
