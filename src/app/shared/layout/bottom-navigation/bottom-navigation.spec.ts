import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { BottomNavigation } from './bottom-navigation';

@Component({ template: '<p>Page</p>' })
class TestPage {}

describe('BottomNavigation', () => {
  it('renders accessible links and marks the active destination', async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavigation],
      providers: [
        provideRouter([
          { path: '', component: TestPage },
          { path: 'match', component: TestPage },
          { path: 'dinner', component: TestPage },
          { path: 'payments', component: TestPage },
        ]),
      ],
    }).compileComponents();
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
});
