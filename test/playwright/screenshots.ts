import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { load } from 'js-yaml';
import { chromium } from 'playwright-core';
import {
  fillSamplePlayer,
  filterFindings,
  parsePageSpec,
  parseScreenshotsSection,
  planPages,
  type Finding,
  type NoiseRule,
  type PageSpec,
  type RouteRule,
} from './lib/plan.ts';
import { serveSite } from './lib/serve.ts';

// Starts the site's Next build with `next start` and screenshots its pages for a PR.
// Run `bun run build` first. Usage:
//   node test/playwright/screenshots.ts [--app .] \
//     [--out screenshots] [--base-ref origin/main | --changed-files list.txt] \
//     [--pr-body body.md] [--page "/csv/ wait: [data-testid=x]"]...
// Writes <out>/<page>-<viewport>.png and <out>/report.json. Exits non-zero
// when a page cannot be loaded or answers with a non-200 status.

function publishedPlayerIds(app: string): string[] {
  const file = path.join(path.resolve(app), 'public', 'data', 'players.json');
  return fs.existsSync(file) ? Object.keys(JSON.parse(fs.readFileSync(file, 'utf-8')).players ?? {}) : [];
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const IDLE_TIMEOUT_MS = 15_000;
const SETTLE_MS = 500;
const WAIT_FOR_TIMEOUT_MS = 10_000;

interface PageReport {
  path: string;
  status: number | null;
  shots: string[];
  findings: Finding[];
  notes: string[];
}

function readYaml<T>(file: string): T {
  return load(fs.readFileSync(path.join(import.meta.dirname, 'config', file), 'utf-8')) as T;
}

function changedFiles(baseRef?: string, listFile?: string): string[] {
  if (listFile) {
    return fs.readFileSync(listFile, 'utf-8').split('\n').map((l) => l.trim()).filter(Boolean);
  }
  if (baseRef) {
    return execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], { encoding: 'utf-8' })
      .split('\n')
      .filter(Boolean);
  }
  return [];
}

function slug(pagePath: string): string {
  const cleaned = pagePath.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '');
  return cleaned || 'home';
}

async function main() {
  const { values } = parseArgs({
    options: {
      app: { type: 'string', default: '.' },
      out: { type: 'string', default: 'screenshots' },
      'base-ref': { type: 'string' },
      'changed-files': { type: 'string' },
      'pr-body': { type: 'string' },
      page: { type: 'string', multiple: true, default: [] },
    },
  });
  const outDir = path.resolve(values.out as string);
  fs.mkdirSync(outDir, { recursive: true });

  const rules = readYaml<{ rules: RouteRule[] }>('screenshots.yml').rules;
  const noise = readYaml<{ noise: NoiseRule[] }>('noise.yml').noise ?? [];
  const fromBody = values['pr-body']
    ? parseScreenshotsSection(fs.readFileSync(values['pr-body'], 'utf-8'))
    : [];
  const requested = [
    ...fromBody,
    ...(values.page as string[])
      .map(parsePageSpec)
      .filter((spec): spec is PageSpec => spec !== null),
  ];
  // Every player in the published index has a page, generated on request at /player/<cms-id>/.
  const playerIds = publishedPlayerIds(values.app as string);
  const pages = fillSamplePlayer(
    planPages({
      changedFiles: changedFiles(values['base-ref'], values['changed-files']),
      rules,
      requested,
    }),
    playerIds
  );

  const server = await serveSite(values.app as string);
  const browser = await chromium.launch().catch((err) => {
    server.close();
    throw err;
  });
  const reports: PageReport[] = [];
  let failed = false;
  try {
    for (const spec of pages) {
      const url = `${server.url}${spec.path}`;
      const report: PageReport = { path: spec.path, status: null, shots: [], findings: [], notes: [] };
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const found: Finding[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') found.push({ kind: 'console', text: msg.text() });
        });
        page.on('pageerror', (err) => found.push({ kind: 'pageerror', text: err.message }));
        page.on('requestfailed', (req) =>
          found.push({ kind: 'request', text: `${req.method()} ${req.url()} ${req.failure()?.errorText ?? ''}`.trim() })
        );
        page.on('response', (res) => {
          if (res.status() >= 400) {
            found.push({ kind: 'request', text: `${res.request().method()} ${res.url()} ${res.status()}` });
          }
        });
        try {
          const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
          report.status = response?.status() ?? null;
          if (response?.status() !== 200) {
            failed = true;
          }
          try {
            await page.waitForLoadState('networkidle', { timeout: IDLE_TIMEOUT_MS });
          } catch {
            report.notes.push(`${viewport.name}: network not idle after ${IDLE_TIMEOUT_MS}ms`);
          }
          await page.waitForTimeout(SETTLE_MS);
          if (spec.waitFor) {
            try {
              await page.waitForSelector(spec.waitFor, { timeout: WAIT_FOR_TIMEOUT_MS });
            } catch {
              report.notes.push(`${viewport.name}: timed out waiting for ${spec.waitFor}`);
            }
          }
          if (spec.delayMs) {
            await page.waitForTimeout(spec.delayMs);
          }
          const file = `${slug(spec.path)}-${viewport.name}.png`;
          await page.screenshot({ path: path.join(outDir, file), fullPage: true });
          report.shots.push(file);
        } catch (err) {
          failed = true;
          report.notes.push(`${viewport.name}: ${(err as Error).message}`);
        } finally {
          report.findings.push(
            ...filterFindings(found, noise).filter(
              (f) => !report.findings.some((e) => e.kind === f.kind && e.text === f.text)
            )
          );
          await context.close();
        }
      }
      reports.push(report);
      console.log(`${report.status ?? 'ERR'} ${spec.path} (${report.shots.length} shots, ${report.findings.length} findings)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ pages: reports }, null, 2));
  if (failed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
