import { MDXProvider } from '@mdx-js/react';
import { AppBar, Box, Container, Link, Toolbar, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import EligibilityPage from '@/pages/EligibilityPage';
import Methodology from '@/pages/Methodology.mdx';

const REPO_URL = 'https://github.com/zmnatz/usa-club-rugby-eligibility';

/** The page in the address hash: the report, or "#/methodology". A hash keeps
 *  links working on a static host with no server-side routes. */
function useRoute(): string {
  const read = () => window.location.hash.replace(/^#\/?/, '');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

// MDX tables and code blocks scroll sideways rather than widening the page on a phone.
const mdxComponents = {
  table: (props: React.ComponentProps<'table'>) => (
    <Box sx={{ overflowX: 'auto' }}>
      <table {...props} />
    </Box>
  ),
  pre: (props: React.ComponentProps<'pre'>) => <Box component="pre" sx={{ overflowX: 'auto' }} {...props} />,
};

export function App() {
  const route = useRoute();
  return (
    <>
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap' }}>
          <Link href="#/" color="inherit" underline="none" sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="span">
              USA Club Rugby Eligibility
            </Typography>
          </Link>
          <Link href="#/methodology" color="inherit">
            Methodology
          </Link>
          <Link href={REPO_URL} color="inherit" target="_blank" rel="noopener noreferrer">
            Source
          </Link>
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {route === 'methodology' ? (
          <Box sx={{ maxWidth: 820, '& h1': { typography: 'h4' }, '& h2': { typography: 'h5', mt: 4 } }}>
            <MDXProvider components={mdxComponents}>
              <Methodology />
            </MDXProvider>
          </Box>
        ) : (
          <>
            <Typography variant="h4" component="h1" gutterBottom>
              NCS Eligibility
            </Typography>
            <EligibilityPage />
          </>
        )}
      </Container>
      <Box component="footer" sx={{ py: 3, textAlign: 'center', color: 'text.secondary', typography: 'body2' }}>
        Not an official USA Rugby or USA Club Rugby tool. Data from Rugby Xplorer.
      </Box>
    </>
  );
}
