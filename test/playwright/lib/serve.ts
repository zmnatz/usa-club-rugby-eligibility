import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Serves the static site build to the browser in the screenshot job, the way
// GitHub Pages does: folders answer with their index.html, and anything missing
// answers 404 with the site's own 404 page.

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
};

function isFile(candidate: string): boolean {
  return fs.statSync(candidate, { throwIfNoEntry: false })?.isFile() ?? false;
}

export function resolveFile(root: string, pathname: string): string | null {
  const wanted = path.join(root, decodeURIComponent(pathname));
  if (wanted !== root && !wanted.startsWith(root + path.sep)) {
    return null;
  }
  return [wanted, path.join(wanted, 'index.html'), `${wanted}.html`].find(isFile) ?? null;
}

export async function serveSite(site: string): Promise<{ url: string; close: () => void }> {
  const root = path.resolve(site);
  const server = http.createServer((req, res) => {
    let file: string | null = null;
    try {
      file = resolveFile(root, new URL(req.url ?? '/', 'http://site').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const notFound = path.join(root, '404.html');
    const served = file ?? (isFile(notFound) ? notFound : null);
    if (!served) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(file ? 200 : 404, {
      'content-type': CONTENT_TYPES[path.extname(served)] ?? 'application/octet-stream',
    });
    fs.createReadStream(served).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}
