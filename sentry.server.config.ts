import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  includeLocalVariables: false,
  enableLogs: true,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
      delete event.request.data;
    }

    if (event.user) {
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }

    return event;
  },
});
