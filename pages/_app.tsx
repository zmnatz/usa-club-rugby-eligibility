import type { AppProps } from 'next/app';
import Head from 'next/head';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { MDXProvider } from '@mdx-js/react';
import {
  AppBar,
  Box,
  Container,
  CssBaseline,
  Link as MuiLink,
  Toolbar,
  Typography,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { AppCacheProvider } from '@mui/material-nextjs/v16-pagesRouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { mdxComponents } from '@/components/Mdx';
import { theme } from '@/theme';
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
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
            <AppBar position="static" color="primary" elevation={0}>
              <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
                <MuiLink
                  component={NextLink}
                  href="/"
                  color="inherit"
                  underline="none"
                  sx={{ flexGrow: 1 }}
                >
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
            <Container
              component="main"
              maxWidth={narrow ? 'md' : 'lg'}
              sx={{ py: 3, flexGrow: 1 }}
            >
              <MDXProvider components={mdxComponents}>
                <Component {...pageProps} />
              </MDXProvider>
            </Container>
            <Box
              component="footer"
              sx={{ py: 3, textAlign: 'center', color: 'text.secondary', typography: 'body2' }}
            >
              Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
            </Box>
          </Box>
        </ThemeProvider>
      </QueryClientProvider>
    </AppCacheProvider>
  );
}
