import { Head, Html, Main, NextScript } from 'next/document';
import { ENHANCEMENT_SCRIPT } from '@zmnatz/usa-club-rugby-components';

export default function SiteDocument() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Cellipse cx=%2216%22 cy=%2216%22 rx=%2214%22 ry=%229%22 fill=%22%231f4e8c%22 transform=%22rotate(-35 16 16)%22/%3E%3C/svg%3E"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
        {/* The report tables' sort, the directory's filter and the export download: one small
            script, on every page, listening on the document. A fixed string, no data in it. */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string */}
        <script dangerouslySetInnerHTML={{ __html: ENHANCEMENT_SCRIPT }} />
      </body>
    </Html>
  );
}
