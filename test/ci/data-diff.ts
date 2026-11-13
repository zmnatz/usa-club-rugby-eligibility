import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { buildComment, diffPublished } from './lib/data-diff.ts';
import { countChanges, countsFor, readPublished } from './lib/published.ts';

// Compares the published data built from a pull request's base and head, and writes
// the change summary the CI job comments on the PR.
//   node test/ci/data-diff.ts --base /tmp/data-base --head public/data \
//     --base-sha <sha> --head-sha <sha> --run-url <url> --out comment.md
const { values } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string', default: 'public/data' },
    'base-sha': { type: 'string' },
    'head-sha': { type: 'string' },
    'run-url': { type: 'string' },
    out: { type: 'string' },
  },
});

const baseDir = values.base;
const headDir = values.head as string;
const out = values.out;
if (!baseDir || !out) throw new Error('Pass --base <dir> and --out <file>.');
if (!fs.existsSync(baseDir)) throw new Error(`No base data at ${baseDir}.`);
if (!fs.existsSync(headDir)) throw new Error(`No head data at ${headDir}.`);

const baseFiles = readPublished(baseDir);
const headFiles = readPublished(headDir);

const comment = buildComment({
  diff: diffPublished(baseFiles, headFiles),
  counts: countChanges(countsFor(baseFiles), countsFor(headFiles)),
  baseSha: values['base-sha'],
  headSha: values['head-sha'],
  runUrl: values['run-url'],
});
fs.writeFileSync(out, `${comment}\n`);
console.log(comment);
