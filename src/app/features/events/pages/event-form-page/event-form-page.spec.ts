import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { GroupService } from '../../../groups/group.service';
import { EventOperationError } from '../../event.models';
import { EventService } from '../../event.service';
import { EventFormPage } from './event-form-page';

describe('EventFormPage', () => {
  const create = vi.fn();

  beforeEach(async () => {
    create.mockReset();
    await TestBed.configureTestingModule({
      imports: [EventFormPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ groupId: 'group-id' }) } },
        },
        { provide: EventService, useValue: { create } },
        { provide: GroupService, useValue: {} },
      ],
    }).compileComponents();
  });

  it('requires date, time, location and court price before creation', () => {
    const fixture = TestBed.createComponent(EventFormPage);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Completá todos los campos con valores válidos.',
    );
  });

  it('announces a safe validation error without exposing backend details', async () => {
    create.mockRejectedValue(new EventOperationError('VALIDATION'));
    const fixture = TestBed.createComponent(EventFormPage);
    fixture.detectChanges();
    fill(fixture.nativeElement, '#event-date', '2026-10-07');
    fill(fixture.nativeElement, '#event-time', '21:30');
    fill(fixture.nativeElement, '#event-location', 'Cancha Central');
    fill(fixture.nativeElement, '#event-price', '50.000');

    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(
        'Revisá la fecha, la hora, el lugar y el precio.',
      );
    });
  });
});

function fill(host: HTMLElement, selector: string, value: string): void {
  const input = host.querySelector<HTMLInputElement>(selector)!;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
