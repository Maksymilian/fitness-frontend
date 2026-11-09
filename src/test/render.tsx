import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { MemberProvider } from '../app/MemberProvider';

/** Renders a page as the app does: a query client, a chosen member and a router at `route`. */
export function renderPage(page: ReactElement, { route = '/', memberId = 'ada@example.com' } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: '*', element: page }], { initialEntries: [route] });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberProvider initialMemberId={memberId}>
        <RouterProvider router={router} />
      </MemberProvider>
    </QueryClientProvider>,
  );
}
