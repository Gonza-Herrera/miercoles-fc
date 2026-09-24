import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { normalizeReturnUrl } from './auth-redirect';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.initialize();

  return auth.isAuthenticated()
    ? true
    : router.createUrlTree(['/auth'], {
        queryParams: { returnUrl: normalizeReturnUrl(state.url) },
      });
};

export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.initialize();

  return auth.isAuthenticated()
    ? router.parseUrl(normalizeReturnUrl(route.queryParamMap.get('returnUrl')))
    : true;
};
