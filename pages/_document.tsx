import { Head, Html, Main, NextScript } from 'next/document';

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
      </body>
    </Html>
  );
}
