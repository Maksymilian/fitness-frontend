/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKOUT_TRACKING_URL?: string;
  readonly VITE_TRAINING_PROGRESS_URL?: string;
  readonly VITE_BILLING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
