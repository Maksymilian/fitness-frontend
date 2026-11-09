/**
 * Where the browser reaches each service: through the dev or preview server's proxy by default
 * (`vite.config.ts`), or straight at a URL from `VITE_*` (Training Progress and Billing only, with
 * this app's origin in their CORS_ORIGINS).
 */
export const SERVICES = {
  workoutTracking: {
    name: 'Workout Tracking',
    api: 'REST, internal',
    url: import.meta.env.VITE_WORKOUT_TRACKING_URL || '/api/workout-tracking',
  },
  trainingProgress: {
    name: 'Training Progress',
    api: 'GraphQL',
    url: import.meta.env.VITE_TRAINING_PROGRESS_URL || '/api/training-progress',
  },
  billing: {
    name: 'Billing',
    api: 'REST',
    url: import.meta.env.VITE_BILLING_URL || '/api/billing',
  },
} as const;

export type ServiceKey = keyof typeof SERVICES;
