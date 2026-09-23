import { TestBed } from '@angular/core/testing';

import { ProgressBar } from './progress-bar';

describe('ProgressBar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProgressBar] }).compileComponents();
  });

  it('exposes progress semantics', () => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Progreso');
    fixture.componentRef.setInput('value', 7);
    fixture.componentRef.setInput('max', 10);
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;

    expect(progress.getAttribute('aria-valuenow')).toBe('7');
    expect(progress.getAttribute('aria-valuemax')).toBe('10');
    expect(progress.getAttribute('aria-valuetext')).toBe('7 of 10');
  });

  it.each([
    [-5, '0'],
    [15, '10'],
    [Number.NaN, '0'],
  ])('clamps %s to a safe value', (value, expected) => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Progreso');
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('max', 10);
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;

    expect(progress.getAttribute('aria-valuenow')).toBe(expected);
  });

  it('uses a safe maximum when max is invalid', () => {
    const fixture = TestBed.createComponent(ProgressBar);
    fixture.componentRef.setInput('label', 'Progreso');
    fixture.componentRef.setInput('value', 120);
    fixture.componentRef.setInput('max', 0);
    fixture.detectChanges();
    const progress = fixture.nativeElement.querySelector('[role="progressbar"]') as HTMLElement;

    expect(progress.getAttribute('aria-valuemax')).toBe('100');
    expect(progress.getAttribute('aria-valuenow')).toBe('100');
  });
});
