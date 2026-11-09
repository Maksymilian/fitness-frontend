import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { MemberProvider } from './app/MemberProvider';
import { createQueryClient } from './app/query-client';
import { routes } from './app/routes';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html has no #root element');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={createQueryClient()}>
      <MemberProvider>
        <RouterProvider router={createBrowserRouter(routes)} />
      </MemberProvider>
    </QueryClientProvider>
  </StrictMode>,
);
