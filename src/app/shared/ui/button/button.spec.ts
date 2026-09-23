import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Button } from './button';

@Component({
  imports: [Button],
  template: '<app-button variant="danger" disabled>Eliminar</app-button>',
})
class TestHost {}

describe('Button', () => {
  it('renders projected content and requested state', async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.textContent).toContain('Eliminar');
    expect(button.classList).toContain('button--danger');
    expect(button.disabled).toBe(true);
  });
});
