import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `
    <app-empty-state title="Sin resultados" description="Probá con otros criterios">
      <span empty-state-icon>Icono</span>
      <button empty-state-action type="button">Reintentar</button>
    </app-empty-state>
  `,
})
class TestHost {}

describe('EmptyState', () => {
  it('renders its copy and projected areas', async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h3')?.textContent).toContain('Sin resultados');
    expect(element.querySelector('p')?.textContent).toContain('Probá con otros criterios');
    expect(element.querySelector('.empty-state__icon')?.textContent).toContain('Icono');
    expect(element.querySelector('button')?.textContent).toContain('Reintentar');
  });
});
