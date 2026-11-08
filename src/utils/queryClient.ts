import { QueryClient } from '@tanstack/react-query';

/** One client for the whole session. The pages are static; this only caches the
 *  fixture list the CSV page loads. */
export const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
