import { TestBed } from '@angular/core/testing';

import { IconButton } from './icon-button';

describe('IconButton', () => {
  it('exposes an accessible name and disabled state', async () => {
    await TestBed.configureTestingModule({ imports: [IconButton] }).compileComponents();
    const fixture = TestBed.createComponent(IconButton);
    fixture.componentRef.setInput('ariaLabel', 'Cerrar');
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toBe('Cerrar');
    expect(button.disabled).toBe(true);
  });
});
