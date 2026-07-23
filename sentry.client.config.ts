import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust sample rate in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this to true will send debug logs to the console
  debug: false,

  // Ignore noisy errors
  ignoreErrors: [
    // OAuth redirect noise
    "invalid_grant",
    // User-driven navigation cancellations
    "NEXT_REDIRECT",
    "NEXT_NOT_FOUND",
  ],

  // Don't send source maps in dev
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
});
