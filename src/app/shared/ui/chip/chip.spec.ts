import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { Chip } from './chip';

describe('Chip', () => {
  it('reflects selection and emits the requested state', async () => {
    await TestBed.configureTestingModule({ imports: [Chip] }).compileComponents();
    const fixture = TestBed.createComponent(Chip);
    fixture.componentRef.setInput('selected', true);
    const selectedChange = vi.fn();
    fixture.componentInstance.selectedChange.subscribe(selectedChange);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(selectedChange).toHaveBeenCalledWith(false);
  });
});
