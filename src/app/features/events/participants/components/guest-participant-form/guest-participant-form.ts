import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { Button } from '../../../../../shared/ui';
import { GuestParticipant, GuestParticipantInput } from '../../models/participant.models';

function activityRequired(control: AbstractControl): ValidationErrors | null {
  const value = control.value as { dines?: boolean; plays?: boolean };
  return value.plays || value.dines ? null : { activityRequired: true };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, ReactiveFormsModule],
  selector: 'app-guest-participant-form',
  styleUrl: './guest-participant-form.scss',
  templateUrl: './guest-participant-form.html',
})
export class GuestParticipantForm {
  private readonly fb = inject(FormBuilder);

  readonly cancelled = output<void>();
  readonly participant = input<GuestParticipant | null>(null);
  readonly saving = input(false);
  readonly submitted = output<GuestParticipantInput>();

  protected readonly form = this.fb.nonNullable.group(
    {
      dines: [false],
      displayName: ['', [Validators.required, Validators.maxLength(100)]],
      plays: [true],
    },
    { validators: activityRequired },
  );

  constructor() {
    effect(() => {
      const participant = this.participant();
      this.form.reset({
        dines: participant?.dinnerResponse === 'YES',
        displayName: participant?.displayName ?? '',
        plays: participant ? participant.footballResponse === 'YES' : true,
      });
    });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const displayName = value.displayName.trim();
    if (!displayName) {
      this.form.controls.displayName.setErrors({ required: true });
      return;
    }
    this.submitted.emit({ displayName, dines: value.dines, plays: value.plays });
  }
}
