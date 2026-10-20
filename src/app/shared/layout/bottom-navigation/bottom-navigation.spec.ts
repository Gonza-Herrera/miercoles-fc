import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { BottomNavigation } from './bottom-navigation';

@Component({ template: '<p>Page</p>' })
class TestPage {}

describe('BottomNavigation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavigation],
      providers: [
        provideRouter([
          { path: '', component: TestPage, data: { navigationSection: 'HOME' } },
          { path: 'match', component: TestPage, data: { navigationSection: 'MATCH' } },
          { path: 'dinner', component: TestPage, data: { navigationSection: 'DINNER' } },
          { path: 'payments', component: TestPage, data: { navigationSection: 'PAYMENTS' } },
          {
            path: 'events/:eventId/lineup',
            component: TestPage,
            data: { navigationSection: 'MATCH' },
          },
        ]),
      ],
    }).compileComponents();
  });

  it('renders accessible links and marks the active destination', async () => {
    const fixture = TestBed.createComponent(BottomNavigation);
    await TestBed.inject(Router).navigateByUrl('/match');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const navigation = element.querySelector('nav');
    const links = Array.from(element.querySelectorAll('a'));

    expect(navigation?.getAttribute('aria-label')).toBe('Navegación principal');
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Inicio',
      'Partido',
      'Cena',
      'Pagos',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/match',
      '/dinner',
      '/payments',
    ]);
    expect(element.querySelector('[aria-current="page"]')?.textContent).toContain('Partido');
  });

  it('keeps an event selected and marks Match inside an Event route', async () => {
    const fixture = TestBed.createComponent(BottomNavigation);
    await TestBed.inject(Router).navigateByUrl('/events/event-7/lineup');
    fixture.detectChanges();
    await fixture.whenStable();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/?eventId=event-7',
      '/match?eventId=event-7',
      '/dinner?eventId=event-7',
      '/payments?eventId=event-7',
    ]);
    expect(fixture.nativeElement.querySelector('[aria-current="page"]')?.textContent).toContain(
      'Partido',
    );
  });
});
