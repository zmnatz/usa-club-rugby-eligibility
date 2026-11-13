import Head from 'next/head';
import { PageLink } from '@/components/Crumbs';

// Old URLs that named a page by query, such as /player/?id=<cms-id>, are redirected
// before they get here, by proxy.ts.
export const config = { unstable_runtimeJS: false };

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Page not found · USA Club Rugby Eligibility</title>
      </Head>
      <h1>Page not found</h1>
      <p className="lead">
        That club or page isn&apos;t here. <PageLink href="/">Choose a club from the full list</PageLink>.
      </p>
    </>
  );
}
