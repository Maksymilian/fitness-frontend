/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

/**
 * The browser calls the three services through this server, under `/api/<service>/`: same origin,
 * so no CORS, and Workout Tracking's internal API (which has no CORS on purpose) is never called
 * from a browser directly. In production a reverse proxy or gateway routes the same paths.
 */
function serviceProxies(env: Record<string, string>): Record<string, ProxyOptions> {
  const services = {
    'workout-tracking': env.WORKOUT_TRACKING_URL || 'http://localhost:3001',
    'training-progress': env.TRAINING_PROGRESS_URL || 'http://localhost:3002',
    billing: env.BILLING_URL || 'http://localhost:3003',
  };
  return Object.fromEntries(
    Object.entries(services).map(([service, target]) => [
      `/api/${service}`,
      { target, rewrite: (path: string) => path.slice(`/api/${service}`.length) || '/' },
    ]),
  );
}

export default defineConfig(({ mode }) => {
  const proxy = serviceProxies(loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react()],
    // 5173 is where Billing's MEMBERSHIP_PAGE_URL sends members back from Stripe's pages.
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      // pnpm test:live runs the *.live-test.ts files instead: against the running services.
      include: process.env.LIVE_SERVICES ? ['src/**/*.live-test.ts'] : ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      unstubGlobals: true,
    },
  };
});
