import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Home } from './home';

describe('Home', () => {
  it('renders the Home placeholder', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Inicio');
    expect(fixture.nativeElement.textContent).toContain('Tu próximo miércoles aparecerá acá.');
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/invitations');
  });
});
