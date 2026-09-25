import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { Button, Card, ConfirmDialog, EmptyState } from '../../../../../shared/ui';
import { GuestParticipantService } from '../../data-access/guest-participant.service';
import {
  GuestOperationError,
  GuestParticipant,
  GuestParticipantInput,
  ParticipantPresentation,
} from '../../models/participant.models';
import { GuestParticipantForm } from '../guest-participant-form/guest-participant-form';
import { ParticipantRow } from '../participant-row/participant-row';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, Card, ConfirmDialog, EmptyState, GuestParticipantForm, ParticipantRow],
  selector: 'app-guest-participant-manager',
  styleUrl: './guest-participant-manager.scss',
  templateUrl: './guest-participant-manager.html',
})
export class GuestParticipantManager implements OnInit {
  private readonly guests = inject(GuestParticipantService);

  readonly eventId = input.required<string>();
  readonly isAdmin = input(false);

  protected readonly editing = signal<GuestParticipant | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly guestList = signal<readonly GuestParticipant[]>([]);
  protected readonly loading = signal(true);
  protected readonly pendingRemoval = signal<GuestParticipant | null>(null);
  protected readonly saving = signal(false);
  protected readonly activeGuests = computed(() =>
    this.guestList().filter((participant) => participant.cancelledAt === null),
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  protected presentation(guest: GuestParticipant): ParticipantPresentation {
    return {
      avatarUrl: null,
      cancelled: guest.cancelledAt !== null,
      dines: guest.dinnerResponse === 'YES',
      displayName: guest.displayName,
      id: guest.id,
      identityLabel: 'Invitado',
      isGuest: true,
      plays: guest.footballResponse === 'YES',
    };
  }

  protected startAdd(): void {
    this.editing.set(null);
    this.formOpen.set(true);
    this.clearMessages();
  }

  protected startEdit(guest: GuestParticipant): void {
    this.editing.set(guest);
    this.formOpen.set(true);
    this.clearMessages();
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected async save(input: GuestParticipantInput): Promise<void> {
    if (this.saving() || !this.isAdmin()) return;
    this.saving.set(true);
    this.clearMessages();
    const current = this.editing();
    try {
      const saved = current
        ? await this.guests.update(current.id, input)
        : await this.guests.add(this.eventId(), input);
      this.guestList.update((list) =>
        current ? list.map((guest) => (guest.id === saved.id ? saved : guest)) : [...list, saved],
      );
      this.feedback.set(current ? 'Invitado actualizado.' : `${saved.displayName} fue agregado.`);
      this.closeForm();
    } catch (error) {
      this.errorMessage.set(this.messageFor(error, 'No pudimos guardar los cambios.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const guest = this.pendingRemoval();
    this.pendingRemoval.set(null);
    if (!guest || this.saving() || !this.isAdmin()) return;
    this.saving.set(true);
    this.clearMessages();
    try {
      const cancelled = await this.guests.cancel(guest.id);
      this.guestList.update((list) =>
        list.map((participant) => (participant.id === cancelled.id ? cancelled : participant)),
      );
      this.feedback.set(`${guest.displayName} fue quitado del evento.`);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error, 'No pudimos quitar al invitado.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      this.guestList.set(await this.guests.list(this.eventId()));
    } catch {
      this.errorMessage.set('No pudimos cargar los invitados.');
    } finally {
      this.loading.set(false);
    }
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.feedback.set(null);
  }

  private messageFor(error: unknown, fallback: string): string {
    if (!(error instanceof GuestOperationError)) return fallback;
    if (error.operation === 'PERMISSION') return 'No tenés permisos para agregar invitados.';
    if (error.operation === 'CLOSED') return 'Este evento ya no permite modificar participantes.';
    if (error.operation === 'VALIDATION') return 'Revisá el nombre y la participación.';
    return fallback;
  }
}
