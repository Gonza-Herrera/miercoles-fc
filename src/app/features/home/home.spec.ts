import { TestBed } from '@angular/core/testing';

import { Home } from './home';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();
  });

  it('renders the design system showcase', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Una base cálida');
    expect(element.textContent).toContain('Miércoles FC');
    expect(element.querySelectorAll('app-button').length).toBeGreaterThan(0);
    expect(element.querySelectorAll('app-card').length).toBeGreaterThan(0);
    expect(element.querySelectorAll('app-progress-bar').length).toBe(3);
  });
});
