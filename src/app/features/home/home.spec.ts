import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { EventService } from '../events/event.service';
import { GroupService } from '../groups/group.service';
import { Home } from './home';

describe('Home', () => {
  it('renders the empty current-event state', async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: { current: vi.fn().mockResolvedValue(null) } },
        { provide: GroupService, useValue: { list: vi.fn().mockResolvedValue([]) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Inicio');
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay un miércoles programado.');
    const links = [...fixture.nativeElement.querySelectorAll('a')].map((link: HTMLAnchorElement) =>
      link.getAttribute('href'),
    );
    expect(links).toContain('/groups');
    expect(links).toContain('/invitations');
  });
});
