import Script from "next/script";

// Google Analytics 4 through the Google tag (gtag.js), as on the Rocky Gorge site (ADR 021).
// The measurement ID is NEXT_PUBLIC_GOOGLE_ANALYTICS, which Next inlines at build time, so a
// build without it (local, CI, a deploy preview it isn't set for) loads nothing.
// `config` sends the first page view; GA's enhanced measurement sends one for each later
// client-side navigation from the browser's history, so nothing here listens to the router.
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS ?? "";

export function GoogleAnalytics({ id = GA_MEASUREMENT_ID }: { id?: string }) {
  if (!id) return null;
  return (
    <>
      <Script
        id="google-analytics-tag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`}
      />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});`}
      </Script>
    </>
  );
}
