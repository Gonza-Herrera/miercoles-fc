import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type AppSection = 'DINNER' | 'HOME' | 'MATCH' | 'PAYMENTS';

export interface SectionDestination {
  readonly queryParams: { readonly eventId: string; readonly returnTo?: string } | null;
  readonly route: string;
}

@Injectable({ providedIn: 'root' })
export class NavigationContextService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly revision = signal(0);

  readonly section = computed(() => {
    this.revision();
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let section: AppSection | undefined;
    while (route) {
      section = (route.data['navigationSection'] as AppSection | undefined) ?? section;
      route = route.firstChild;
    }
    return section;
  });
  readonly eventId = computed(() => {
    this.revision();
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let eventId = route.queryParamMap.get('eventId');
    while (route) {
      eventId = route.paramMap.get('eventId') ?? eventId;
      route = route.firstChild;
    }
    return eventId;
  });
  readonly returnUrl = computed(() => {
    this.revision();
    return safeInternalReturnUrl(
      this.router.routerState.snapshot.root.queryParamMap.get('returnTo'),
    );
  });

  constructor() {
    const subscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => this.revision.update((value) => value + 1));
    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }

  destination(route: string): SectionDestination {
    const eventId = this.eventId();
    const returnTo = this.returnUrl();
    return {
      queryParams: eventId ? { eventId, ...(returnTo ? { returnTo } : {}) } : null,
      route,
    };
  }
}

export function safeInternalReturnUrl(value: string | null): string | null {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('://')) return null;
  return value;
}
