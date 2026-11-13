import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { addEntry, formatDate } from './lib/changes-page.ts';
import { buildEntry, changeSummary, diffPublished } from './lib/data-diff.ts';
import { countChanges, countsFor, readPublished } from './lib/published.ts';

// Adds the nightly data change to the published changes page.
//   node test/ci/changes-page.ts --base /tmp/data-base --head public/data \
//     --date 2026-11-14 --page pages/changes.mdx
const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string', default: 'public/data' },
    page: { type: 'string', default: 'pages/changes.mdx' },
    date: { type: 'string' },
  },
});

const baseDir = values.base;
const headDir = values.head as string;
const page = values.page as string;
const date = values.date;
if (!baseDir || !date) throw new Error('Pass --base <dir> and --date <YYYY-MM-DD>.');
if (!fs.existsSync(baseDir)) throw new Error(`No base data at ${baseDir}.`);
if (!fs.existsSync(headDir)) throw new Error(`No head data at ${headDir}.`);
if (!fs.existsSync(page)) throw new Error(`No changes page at ${page}.`);

const baseFiles = readPublished(baseDir);
const headFiles = readPublished(headDir);
const diff = diffPublished(baseFiles, headFiles);
const counts = countChanges(countsFor(baseFiles), countsFor(headFiles));

if (diff.unchanged) {
  console.log('No published data changed; the page is unchanged.');
  process.exit(0);
}

const entry = buildEntry({
  diff,
  counts,
  id: `change-${date}`,
  title: `${formatDate(date)} — ${changeSummary(diff)}`,
});
const result = addEntry(fs.readFileSync(page, 'utf-8'), entry);
fs.writeFileSync(page, result.page);
console.log(`${result.replaced ? 'Updated' : 'Added'} ${date}: ${changeSummary(diff)}.`);
