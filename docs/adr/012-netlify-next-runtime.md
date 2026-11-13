# The site runs on Netlify's Next.js runtime, not GitHub Pages

**Supersedes the hosting in [ADR 008](008-static-player-pages.md)** ("GitHub Pages keeps deploying the full site") **and the GitHub Pages URL in [ADR 003](003-library-and-verify.md).**

Issue #83. The site was a static export (`output: 'export'` to `dist/`) that the nightly workflow deployed to GitHub Pages under `/usa-club-rugby-eligibility/`. Pages deploys stalled intermittently on GitHub's side (ADR 007), a project site needed a base path threaded through the build, and a static host can't render a page on demand. Netlify already built every push and pull request (ADR 008).

Decisions, so they are not "fixed" later:

- **Netlify builds and serves the Next app.** `netlify.toml` runs `bun run build` (`next build`), and Netlify's Next.js runtime serves `.next`, so dynamic routes, on-demand generation and server rendering are available. The runtime keeps Next's build cache, so the export-only `next-cache` plugin is gone.
- **Page behaviour doesn't change yet.** Every page is still generated at build time (`getStaticPaths` with `fallback: false`), and URLs keep their trailing slash. Moving a page to on-demand generation is a separate decision; club pages moved in [ADR 014](014-club-pages-on-demand.md).
- **No base path and no export directory.** The site is served from the root of `usa-club-rugby-eligibility.netlify.app`, so `BASE_PATH`, `NEXT_PUBLIC_BASE_PATH` and `dist/` are gone.
- **A merge into `main` deploys.** The nightly workflow (`.github/workflows/snapshot.yml`) only refreshes the archive and merges its pull request, with `contents` and `pull-requests` write and nothing for Pages. Netlify's GitHub integration builds the push to `main`, so it doesn't matter that a push made with `GITHUB_TOKEN` starts no workflows.
- **A deployed build is always complete.** `selectClubs` ignores `BUILD_CLUBS` when `NETLIFY` is set, rather than under GitHub Actions, since deploys no longer build there.
- **Deploy previews replace the preview artifact.** Each pull request gets a Netlify deploy preview, so CI no longer uploads a static build. PR screenshots still come from a partial build inside the CI job, served with `next start` (`test/playwright/lib/serve.ts`), which is how the runtime serves it too.
- **The published data moved with the site.** `DEFAULT_PUBLISHED_URL` is `https://usa-club-rugby-eligibility.netlify.app/data`. The file layout and shapes are unchanged. The GitHub Pages copy is no longer updated.
