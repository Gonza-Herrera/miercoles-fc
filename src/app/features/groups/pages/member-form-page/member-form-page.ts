import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PageContainer } from '../../../../shared/layout';
import { Avatar, Button, Card } from '../../../../shared/ui';
import { GroupMember, GroupMemberRole, GroupOperationError } from '../../group.models';
import { GroupService } from '../../group.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, Card, PageContainer, ReactiveFormsModule, RouterLink],
  selector: 'app-member-form-page',
  styleUrl: '../../groups.shared.scss',
  templateUrl: './member-form-page.html',
})
export class MemberFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly groups = inject(GroupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly member = signal<GroupMember | null>(null);
  protected readonly saving = signal(false);
  protected readonly selectedAvatar = signal<File | null>(null);
  protected readonly groupId = this.route.snapshot.paramMap.get('groupId')!;
  protected readonly memberId = this.route.snapshot.paramMap.get('memberId');
  protected readonly form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.maxLength(100)]],
    nickname: ['', [Validators.maxLength(60)]],
    role: ['MEMBER' as GroupMemberRole, [Validators.required]],
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const group = await this.groups.get(this.groupId);
      if (group.membership.role !== 'ADMIN') {
        this.errorMessage.set('No tenés permisos para administrar miembros.');
        return;
      }
      if (this.memberId) {
        const member = group.members.find((item) => item.id === this.memberId);
        if (!member) throw new GroupOperationError('NOT_FOUND');
        this.member.set(member);
        this.form.setValue({
          displayName: member.displayName,
          nickname: member.nickname ?? '',
          role: member.role,
        });
      }
    } catch {
      this.errorMessage.set('No pudimos cargar el miembro.');
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
      const input = this.form.getRawValue();
      const memberId = this.memberId ?? (await this.groups.addMember(this.groupId, input));
      if (this.memberId) {
        await this.groups.updateMember(memberId, input);
        if (input.role !== this.member()?.role) await this.groups.changeRole(memberId, input.role);
      }
      if (this.selectedAvatar()) {
        await this.groups.uploadMemberAvatar(this.groupId, memberId, this.selectedAvatar()!);
      }
      await this.router.navigate(['/groups', this.groupId]);
    } catch (error) {
      this.errorMessage.set(
        error instanceof GroupOperationError && error.operation === 'LAST_ADMIN'
          ? 'El grupo debe conservar al menos un administrador.'
          : error instanceof GroupOperationError && error.operation === 'AVATAR'
            ? 'El miembro se guardó, pero no pudimos subir el avatar. Usá JPEG, PNG o WebP de hasta 2 MB.'
            : 'No pudimos guardar el miembro.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
