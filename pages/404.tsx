import NextLink from 'next/link';
import { Link as MuiLink, Typography } from '@mui/material';

export default function NotFoundPage() {
  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Typography color="text.secondary">
        That club or page isn&apos;t here. <MuiLink component={NextLink} href="/">Choose a club
        from the full list</MuiLink>.
      </Typography>
    </>
  );
}
