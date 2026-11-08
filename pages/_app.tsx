import type { AppProps } from 'next/app';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { MDXProvider } from '@mdx-js/react';
import { AppBar, CssBaseline, Link as MuiLink, Toolbar, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider } from '@mui/material-nextjs/v16-pagesRouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { mdxComponents } from '@/components/Mdx';
import { BrandLink, Footer, Main, Shell, theme } from '@/theme';
import { queryClient } from '@/utils/queryClient';

const REPO_URL = 'https://github.com/zmnatz/usa-club-rugby-eligibility';

const DESCRIPTION =
  'NCS player eligibility for every USA Club Rugby senior club, worked out from the Rugby Xplorer match record.';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const narrow = router.pathname === '/methodology';
  return (
    <AppCacheProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <meta name="description" content={DESCRIPTION} />
            <title>USA Club Rugby Eligibility</title>
          </Head>
          <Shell>
            <AppBar position="static" color="primary" elevation={0}>
              <Toolbar>
                <BrandLink component={NextLink} href="/" color="inherit" underline="none">
                  <Typography variant="h6" component="span">
                    USA Club Rugby Eligibility
                  </Typography>
                </BrandLink>
                <MuiLink component={NextLink} href="/methodology" color="inherit">
                  Methodology
                </MuiLink>
                <MuiLink href={REPO_URL} color="inherit" target="_blank" rel="noopener noreferrer">
                  Source
                </MuiLink>
              </Toolbar>
            </AppBar>
            <Main component="main" maxWidth={narrow ? 'md' : 'lg'}>
              <MDXProvider components={mdxComponents}>
                <Component {...pageProps} />
              </MDXProvider>
            </Main>
            <Footer>
              Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
            </Footer>
          </Shell>
        </ThemeProvider>
      </QueryClientProvider>
    </AppCacheProvider>
  );
}
