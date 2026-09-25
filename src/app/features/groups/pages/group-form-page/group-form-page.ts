import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Button, Card } from '../../../../shared/ui';
import { GroupDetail, GroupOperationError } from '../../group.models';
import { GroupService } from '../../group.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, Card, PageContainer, ReactiveFormsModule, RouterLink],
  selector: 'app-group-form-page',
  styleUrl: '../../groups.shared.scss',
  templateUrl: './group-form-page.html',
})
export class GroupFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly group = signal<GroupDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly selectedAvatar = signal<File | null>(null);
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId');
  protected readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.maxLength(500)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  async ngOnInit(): Promise<void> {
    if (!this.groupId) return;
    this.loading.set(true);
    try {
      const group = await this.groups.get(this.groupId);
      if (group.membership.role !== 'ADMIN') {
        this.errorMessage.set('No tenés permisos para editar este grupo.');
        return;
      }
      this.group.set(group);
      this.form.setValue({ description: group.description ?? '', name: group.name });
    } catch {
      this.errorMessage.set('No pudimos cargar el grupo.');
    } finally {
      this.loading.set(false);
    }
  }

  protected selectAvatar(event: Event): void {
    this.selectedAvatar.set((event.target as HTMLInputElement).files?.[0] ?? null);
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const value = this.form.getRawValue();
      const id = this.groupId ?? (await this.groups.create(value));
      if (this.groupId) await this.groups.updateGroup(id, value);
      if (this.selectedAvatar()) await this.groups.uploadGroupAvatar(id, this.selectedAvatar()!);
      await this.router.navigate(['/groups', id]);
    } catch (error) {
      this.errorMessage.set(
        error instanceof GroupOperationError && error.operation === 'AVATAR'
          ? 'El grupo se guardó, pero no pudimos subir el avatar. Usá JPEG, PNG o WebP de hasta 2 MB.'
          : this.groupId
            ? 'No pudimos guardar los cambios.'
            : 'No pudimos crear el grupo.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
