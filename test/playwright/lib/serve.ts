import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

// Runs the site's Next build (`next build`, in <app>/.next) with `next start` for the
// screenshot job, as Netlify's Next.js runtime serves it (ADR 012).

const START_TIMEOUT_MS = 60_000;

/** The player ids a build prerendered, from the routes in Next's prerender manifest. */
export function prerenderedPlayerIds(manifest: { routes?: Record<string, unknown> }): string[] {
  return Object.keys(manifest.routes ?? {})
    .map((route) => /^\/player\/([^/]+)\/?$/.exec(route)?.[1])
    .filter((id): id is string => id !== undefined);
}

export function builtPlayerIds(app: string): string[] {
  const file = path.join(path.resolve(app), '.next', 'prerender-manifest.json');
  return fs.existsSync(file) ? prerenderedPlayerIds(JSON.parse(fs.readFileSync(file, 'utf-8'))) : [];
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as net.AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

export async function serveSite(app: string): Promise<{ url: string; close: () => void }> {
  const root = path.resolve(app);
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(path.join(root, 'node_modules', '.bin', 'next'), ['start', '-H', '127.0.0.1', '-p', String(port)], {
    cwd: root,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const exited = new Promise<never>((_, reject) =>
    server.once('exit', (code) => reject(new Error(`next start exited with code ${code}`)))
  );
  const ready = (async () => {
    const deadline = Date.now() + START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      try {
        await fetch(url);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    throw new Error(`next start did not answer within ${START_TIMEOUT_MS}ms`);
  })();
  try {
    await Promise.race([ready, exited]);
  } catch (err) {
    server.kill();
    throw err;
  }
  exited.catch(() => {});
  return { url, close: () => server.kill() };
}
