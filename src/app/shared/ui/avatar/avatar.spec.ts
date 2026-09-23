import { TestBed } from '@angular/core/testing';

import { Avatar } from './avatar';

describe('Avatar', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
  });

  it.each([
    ['Gonzalo Herrera', 'GH'],
    ['Gazpar', 'G'],
    ['Diego', 'D'],
  ])('renders initials for %s', (name, initials) => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.avatar__fallback')?.textContent).toBe(initials);
  });

  it('renders an image with its accessible alternative', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('name', 'Gonzalo Herrera');
    fixture.componentRef.setInput('src', '/avatar.jpg');
    fixture.componentRef.setInput('alt', 'Gonzalo sonriendo');
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;

    expect(image.getAttribute('src')).toBe('/avatar.jpg');
    expect(image.alt).toBe('Gonzalo sonriendo');
  });
});
