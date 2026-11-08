import type { AppProps } from 'next/app';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { type ComponentProps, useEffect, useRef } from 'react';
import { MDXProvider } from '@mdx-js/react';
import { AppBar, Container, CssBaseline, Link as MuiLink, Stack, Toolbar, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider, type EmotionCacheProviderProps } from '@mui/material-nextjs/v16-pagesRouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { EligibilityLinksProvider, SkipToFirstPlayer } from '@zmnatz/usa-club-rugby-components';
import { mdxComponents } from '@/components/Mdx';
import { theme } from '@/theme';
import { routes } from '@/utils/paths';
import { queryClient } from '@/utils/queryClient';

const REPO_URL = 'https://github.com/zmnatz/usa-club-rugby-eligibility';

const DESCRIPTION =
  'NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record.';

// The package links to every club and player on a page, often hundreds of them.
// Next still prefetches each one when it's hovered.
function PackageLink(props: ComponentProps<typeof NextLink>) {
  return <NextLink prefetch={false} {...props} />;
}

export default function App({
  Component,
  pageProps,
  emotionCache,
}: AppProps & EmotionCacheProviderProps) {
  const router = useRouter();
  const narrow = router.pathname === '/methodology';
  const clubReport = router.pathname === '/club/[club]';

  // Arriving from another page leaves focus partway down this one, past the skip
  // link. A full page load already starts Tab at the link.
  const skipLink = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const focusSkipLink = () => skipLink.current?.focus();
    router.events.on('routeChangeComplete', focusSkipLink);
    return () => router.events.off('routeChangeComplete', focusSkipLink);
  }, [router.events]);

  return (
    // _document supplies the cache it extracts into the <head> of the static HTML.
    // Without it the theme's variables land at the end of <body>, after the content.
    <AppCacheProvider emotionCache={emotionCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <EligibilityLinksProvider Link={PackageLink} routes={routes}>
            <CssBaseline />
            <Head>
              <meta name="viewport" content="width=device-width, initial-scale=1" />
              <meta name="description" content={DESCRIPTION} />
              <title>USA Club Rugby Eligibility</title>
            </Head>
            <Stack sx={{ minHeight: '100dvh' }}>
              {clubReport && <SkipToFirstPlayer ref={skipLink} />}
              <AppBar position="static" color="primary" elevation={0}>
                <Toolbar sx={{ flexWrap: 'wrap', gap: 2 }}>
                  <MuiLink component={NextLink} href="/" color="inherit" underline="none" sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="span">
                      USA Club Rugby Eligibility
                    </Typography>
                  </MuiLink>
                  <MuiLink component={NextLink} href="/methodology" color="inherit">
                    Methodology
                  </MuiLink>
                  <MuiLink href={REPO_URL} color="inherit" target="_blank" rel="noopener noreferrer">
                    Source
                  </MuiLink>
                </Toolbar>
              </AppBar>
              <Container component="main" maxWidth={narrow ? 'md' : 'lg'} sx={{ py: 3, flexGrow: 1 }}>
                <MDXProvider components={mdxComponents}>
                  <Component {...pageProps} />
                </MDXProvider>
              </Container>
              <Typography component="footer" variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
              </Typography>
            </Stack>
          </EligibilityLinksProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </AppCacheProvider>
  );
}
