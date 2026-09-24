export const AUTH_CALLBACK_PATH = '/auth/callback';

export function normalizeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  try {
    const candidate = new URL(value, 'https://miercoles-fc.local');
    const normalized = `${candidate.pathname}${candidate.search}${candidate.hash}`;

    if (
      candidate.origin !== 'https://miercoles-fc.local' ||
      candidate.pathname.startsWith('/auth')
    ) {
      return '/';
    }

    return normalized;
  } catch {
    return '/';
  }
}

export function createAuthCallbackUrl(origin: string, returnUrl?: string | null): string {
  const callback = new URL(AUTH_CALLBACK_PATH, origin);
  const safeReturnUrl = normalizeReturnUrl(returnUrl);

  if (safeReturnUrl !== '/') {
    callback.searchParams.set('returnUrl', safeReturnUrl);
  }

  return callback.toString();
}
