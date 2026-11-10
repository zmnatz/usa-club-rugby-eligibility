import type { AppProps } from 'next/app';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import type { ComponentProps } from 'react';
import { AppBar, Container, CssBaseline, Link as MuiLink, Stack, Toolbar, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider, type EmotionCacheProviderProps } from '@mui/material-nextjs/v16-pagesRouter';
import { EligibilityLinksProvider, SkipToFirstPlayer } from '@zmnatz/usa-club-rugby-components';
import { theme } from '@/theme';
import '@/theme/theme.css';
import { ISSUES_URL, REPO_URL, routes } from '@/utils/paths';

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
  const clubReport = router.pathname === '/club/[club]' || (router.pathname === '/season' && Boolean(router.query.club));

  return (
    // _document supplies the cache it extracts into the <head> of the static HTML.
    // Without it the components' styles land at the end of <body>, after the content.
    <AppCacheProvider emotionCache={emotionCache}>
      {/* The theme's CSS variables come from theme.css, once, not from every page. */}
      <ThemeProvider theme={theme} disableStyleSheetGeneration>
        <EligibilityLinksProvider Link={PackageLink} routes={routes}>
          <CssBaseline />
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="description" content={DESCRIPTION} />
            <title>USA Club Rugby Eligibility</title>
          </Head>
          <Stack sx={{ minHeight: '100dvh' }}>
            {clubReport && <SkipToFirstPlayer />}
            <AppBar position="static" color="primary" elevation={0}>
              <Toolbar sx={{ flexWrap: 'wrap', gap: 2 }}>
                <MuiLink component={NextLink} prefetch={false} href="/" color="inherit" underline="none" sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" component="span">
                    USA Club Rugby Eligibility
                  </Typography>
                </MuiLink>
                <MuiLink component={NextLink} prefetch={false} href="/methodology" color="inherit">
                  Methodology
                </MuiLink>
                <MuiLink href={REPO_URL} color="inherit" target="_blank" rel="noopener noreferrer">
                  Source
                </MuiLink>
                <MuiLink href={ISSUES_URL} color="inherit" target="_blank" rel="noopener noreferrer">
                  Report a problem
                </MuiLink>
              </Toolbar>
            </AppBar>
            <Container component="main" maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
              <Component {...pageProps} />
            </Container>
            <Typography component="footer" variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
              Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
            </Typography>
          </Stack>
        </EligibilityLinksProvider>
      </ThemeProvider>
    </AppCacheProvider>
  );
}
