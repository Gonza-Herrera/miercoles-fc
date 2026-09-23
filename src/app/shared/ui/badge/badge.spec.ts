import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Badge } from './badge';

@Component({
  imports: [Badge],
  template: '<app-badge variant="success">Listo</app-badge>',
})
class TestHost {}

describe('Badge', () => {
  it('renders content with its semantic variant', async () => {
    await TestBed.configureTestingModule({ imports: [TestHost] }).compileComponents();
    const fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    const badge = fixture.nativeElement.querySelector('.badge') as HTMLElement;

    expect(badge.textContent).toContain('Listo');
    expect(badge.classList).toContain('badge--success');
  });
});
