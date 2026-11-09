import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../platform/http';

/**
 * A refused request (4xx) isn't retried: the same request gets the same answer. A service that
 * didn't answer, or a 5xx, gets one more try.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failures, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failures < 1,
        staleTime: 2_000,
      },
      mutations: { retry: false },
    },
  });
}
