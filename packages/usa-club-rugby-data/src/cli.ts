#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { requestStats } from './api.ts';
import { runSnapshot, verifyPublished } from './node/snapshot.ts';
import { DEFAULT_RULES } from './rules.ts';
import { DEFAULT_SOURCES } from './sources.ts';

const USAGE = `usa-club-rugby-data <command> [options]

Commands
  snapshot   Refresh the raw archive from the Rugby Xplorer CMS, then calculate the published data from it
  build      Calculate the published data from the archive alone (same as snapshot --offline)
  verify     Recalculate the published data from the archive and fail if it differs from what is published
  rules      Print the rules and sources in effect, as JSON

Options
  --archive <dir>     Raw match archive            (default: ./archive)
  --published <dir>   Published data               (default: ./public/data)
  --offline           snapshot: make no CMS requests
  --full-history      snapshot: also read every past season the feeds list
  --now <iso>         build/verify: the time to calculate for (verify defaults to the published index's generatedAt)
  --cache <dir>       snapshot/build: keep the Locked Seasons' files here and reuse them while their archive and this
                      package's code are unchanged (verify always recalculates)
`;

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    archive: { type: 'string', default: 'archive' },
    published: { type: 'string', default: 'public/data' },
    offline: { type: 'boolean', default: false },
    'full-history': { type: 'boolean', default: false },
    now: { type: 'string' },
    cache: { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false },
  },
});

const [command] = positionals;
const startedAt = Date.now();
const log = (message: string) => console.log(`[${((Date.now() - startedAt) / 1000).toFixed(0)}s] ${message}`);
const paths = { archiveDir: values.archive as string, publishedDir: values.published as string };
const now = values.now ? new Date(values.now) : undefined;

if (values.help || !command) {
  console.log(USAGE);
} else if (command === 'snapshot' || command === 'build') {
  const result = await runSnapshot({
    ...paths,
    offline: command === 'build' || values.offline,
    fullHistory: values['full-history'],
    now,
    cacheDir: values.cache,
    log,
  });
  log(`Done: ${result.clubs} clubs, ${requestStats.requests} CMS requests`);
} else if (command === 'verify') {
  const result = verifyPublished({ ...paths, now });
  const list = (label: string, names: string[]) =>
    names.length > 0 && console.log(`${label}:\n${names.map((name) => `  ${name}`).join('\n')}`);
  list('Differ from the recalculation', result.different);
  list('Not published', result.missing);
  list('Published but not produced by the archive', result.extra);
  console.log(
    result.ok
      ? `OK: ${result.checked} published files reproduce from the archive (as of ${result.asOf}).`
      : 'FAILED: run `usa-club-rugby-data build`, check the diff and commit it, or revert the change that caused it.',
  );
  process.exitCode = result.ok ? 0 : 1;
} else if (command === 'rules') {
  console.log(JSON.stringify({ rules: DEFAULT_RULES, sources: DEFAULT_SOURCES }, null, 2));
} else {
  console.error(`Unknown command "${command}".\n\n${USAGE}`);
  process.exitCode = 2;
}
