import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Lower trace sampling on server (higher traffic)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  debug: false,

  // Ignore OAuth-related errors that are user-actionable, not bugs
  ignoreErrors: ["invalid_grant"],
});
