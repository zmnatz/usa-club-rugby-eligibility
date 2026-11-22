# Google Analytics, as on the Rocky Gorge site

We want to know which pages are used: which clubs and players are looked up, and how visitors get around the report. The Rocky Gorge site already does this with Google Analytics 4 through the Google tag (`gtag.js`), loaded by `next/script` from `_app` with the measurement ID in `NEXT_PUBLIC_GOOGLE_ANALYTICS`. This site does the same.

Decisions, so they are not "fixed" later:

- **The Google tag, not `@next/third-parties` or Tag Manager.** `src/components/GoogleAnalytics.tsx` writes the same two scripts as Rocky Gorge's, and `pages/_app.tsx` renders it on every page. No new dependency.
- **The ID is a Netlify environment variable, not code.** `NEXT_PUBLIC_GOOGLE_ANALYTICS` is inlined at build time, so a build without it (local, CI, the screenshot job, any Netlify context it isn't set for) loads no script at all. Unlike Rocky Gorge's, the component renders nothing then, rather than asking for `gtag/js?id=undefined`.
- **After hydration, not on idle.** The scripts load `afterInteractive`, as Next recommends for analytics; Rocky Gorge's `lazyOnload` can miss a visitor who leaves quickly.
- **Page views come from GA's enhanced measurement.** `gtag('config', …)` sends the first page's view. Each later navigation, including a filter, sort or toggle that changes the URL (see "State is in the URL" in `AGENTS.md`), is a history change, which GA's "Page changes based on browser history events" setting (on by default) counts as a page view. Nothing listens to the router, so a view can't be sent twice. If that setting is turned off, only first loads are counted.
- **It is not the site's own script.** ADR 010's "no script of its own" is about the site's behaviour; this script changes nothing on the page.
- **The 404 page isn't counted.** It ships no JavaScript (`unstable_runtimeJS: false`, ADR 009), and `next/script` needs it. Old query-named URLs are redirected by `proxy.ts` before they get there, so what's missed is mistyped links.
