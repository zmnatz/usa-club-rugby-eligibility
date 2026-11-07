import { QueryClient } from '@tanstack/react-query';

/** One client for the whole session. The pages are static; this only caches the
 *  live pull a club page makes when it opens. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
