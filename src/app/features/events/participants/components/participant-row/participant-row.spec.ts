import { TestBed } from '@angular/core/testing';

import { EventParticipantRow, toParticipantPresentation } from '../../models/participant.models';
import { ParticipantRow } from './participant-row';

describe('ParticipantRow', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [ParticipantRow] }));

  it('presents a guest with its name, label, and avatar fallback', () => {
    const fixture = TestBed.createComponent(ParticipantRow);
    fixture.componentRef.setInput('participant', toParticipantPresentation(row()));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Martín');
    expect(fixture.nativeElement.textContent).toContain('Invitado');
    expect(fixture.nativeElement.querySelector('.avatar__fallback').textContent).toContain('M');
  });

  it('presents a persistent member without guest semantics', () => {
    const fixture = TestBed.createComponent(ParticipantRow);
    fixture.componentRef.setInput(
      'participant',
      toParticipantPresentation(row({ group_member_id: 'member-id', guest_display_name: null }), {
        avatarUrl: null,
        displayName: 'Gonzalo',
      }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Gonzalo');
    expect(fixture.nativeElement.textContent).toContain('Asistente');
    expect(fixture.nativeElement.textContent).not.toContain('Invitado');
  });
});

function row(overrides: Partial<EventParticipantRow> = {}): EventParticipantRow {
  return {
    actual_dinner: 'UNSET',
    actual_football: 'UNSET',
    cancelled_at: null,
    created_at: '2026-09-25T10:00:00Z',
    created_by: 'profile-id',
    dinner_response: 'YES',
    event_id: 'event-id',
    football_response: 'YES',
    group_member_id: null,
    guest_display_name: 'Martín',
    id: 'participant-id',
    updated_at: '2026-09-25T10:00:00Z',
    ...overrides,
  };
}
