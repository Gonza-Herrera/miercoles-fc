import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Card } from './card';

@Component({
  imports: [Card],
  template: '<app-card variant="elevated"><p>Contenido flexible</p></app-card>',
})
class TestHost {}

describe('Card', () => {
  it('projects content and applies its variant', async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('article') as HTMLElement;

    expect(card.textContent).toContain('Contenido flexible');
    expect(card.classList).toContain('card--elevated');
  });
});
