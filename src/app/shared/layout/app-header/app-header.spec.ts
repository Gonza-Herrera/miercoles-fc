import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppHeader } from './app-header';

describe('AppHeader', () => {
  it('renders the application identity and demo profile', async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeader],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('header')).toBeTruthy();
    expect(element.querySelector('.app-header__brand')?.textContent).toContain('Miércoles FC');
    expect(element.querySelector('app-avatar')?.textContent).toContain('MF');
    expect(element.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Perfil de demostración',
    );
  });
});
