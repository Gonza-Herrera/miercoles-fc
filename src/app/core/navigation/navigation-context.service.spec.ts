import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { NavigationContextService, safeInternalReturnUrl } from './navigation-context.service';

@Component({ template: '' })
class TestPage {}

describe('NavigationContextService', () => {
  it('preserves an explicit event across sections and resolves nested route metadata', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'events/:eventId/lineup',
            component: TestPage,
            data: { navigationSection: 'MATCH' },
          },
          { path: 'dinner', component: TestPage, data: { navigationSection: 'DINNER' } },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    const context = TestBed.inject(NavigationContextService);

    await router.navigateByUrl(
      '/events/event-7/lineup?returnTo=%2Fgroups%2Fgroup-1%2Fhistory%2Fevent-7',
    );

    expect(context.section()).toBe('MATCH');
    expect(context.eventId()).toBe('event-7');
    expect(context.destination('/dinner')).toEqual({
      queryParams: {
        eventId: 'event-7',
        returnTo: '/groups/group-1/history/event-7',
      },
      route: '/dinner',
    });
  });

  it('accepts only internal return destinations', () => {
    expect(safeInternalReturnUrl('/groups/group-1/history/event-7')).toBe(
      '/groups/group-1/history/event-7',
    );
    expect(safeInternalReturnUrl('https://malicious.example')).toBeNull();
    expect(safeInternalReturnUrl('//malicious.example')).toBeNull();
  });
});
