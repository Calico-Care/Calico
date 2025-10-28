import * as Sentry from '@sentry/react-native';
import type { Breadcrumb, Event } from '@sentry/types';
import Constants from 'expo-constants';

import { env } from '@/config/env';

import { redact } from './redact';

let initialized = false;

function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (!breadcrumb) {
    return breadcrumb;
  }

  const sanitised: Breadcrumb = { ...breadcrumb };

  if (sanitised.data) {
    sanitised.data = redact(sanitised.data) as Record<string, unknown>;
  }

  return sanitised;
}

function scrubEvent<T extends Event>(event: T): T | null {
  if (!event) {
    return event;
  }

  const sanitised: Event = { ...event };

  sanitised.user = undefined;

  if (sanitised.request) {
    const { request } = sanitised;
    if (request.headers) {
      request.headers = undefined;
    }
    if (request.cookies) {
      request.cookies = undefined;
    }
    if (request.data) {
      request.data = undefined;
    }
  }

  if (sanitised.contexts) {
    if (sanitised.contexts.device) {
      sanitised.contexts.device.ip_address = undefined;
    }
    sanitised.contexts = redact(sanitised.contexts) as typeof sanitised.contexts;
  }

  if (sanitised.tags) {
    sanitised.tags = redact(sanitised.tags) as typeof sanitised.tags;
  }

  if (sanitised.extra) {
    sanitised.extra = redact(sanitised.extra) as typeof sanitised.extra;
  }

  if (sanitised.breadcrumbs) {
    sanitised.breadcrumbs = sanitised.breadcrumbs
      .map((breadcrumb) => scrubBreadcrumb(breadcrumb) ?? undefined)
      .filter(Boolean) as Breadcrumb[];
  }

  return sanitised as T;
}

export function initSentry(): typeof Sentry {
  if (initialized) {
    return Sentry;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? env.sentryDsn;
  const environment = process.env.EXPO_PUBLIC_ENV ?? 'production';

  const appVersion = Constants.expoConfig?.version ?? env.appVersion ?? '1.0.0';
  const releaseSha =
    process.env.EXPO_PUBLIC_RELEASE_SHA ??
    process.env.RELEASE_SHA ??
    (Constants.expoConfig?.extra as Record<string, unknown>)?.releaseSha ??
    '';

  const release = releaseSha ? `${appVersion}+${releaseSha}` : appVersion;

  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    enableAutoPerformanceTracing: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
  });

  initialized = true;

  return Sentry;
}

export { Sentry };
