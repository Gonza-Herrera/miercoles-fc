import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { normalizeReturnUrl } from '../../../core/auth/auth-redirect';
import { AuthService } from '../../../core/auth/auth.service';
import { Button } from '../../../shared/ui';

type AuthAction = 'GOOGLE' | 'MAGIC_LINK' | null;

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, ReactiveFormsModule],
  selector: 'app-auth-page',
  styleUrl: './auth-page.scss',
  templateUrl: './auth-page.html',
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly returnUrl = normalizeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });
  protected readonly activeAction = signal<AuthAction>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sentEmail = signal<string | null>(null);

  protected async sendMagicLink(): Promise<void> {
    if (this.activeAction() || this.form.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }

    const email = this.form.controls.email.value.trim();
    this.activeAction.set('MAGIC_LINK');
    this.errorMessage.set(null);

    try {
      await this.auth.requestMagicLink(email, this.returnUrl);
      this.sentEmail.set(email);
    } catch {
      this.errorMessage.set('No pudimos enviar el enlace. Intentá nuevamente.');
    } finally {
      this.activeAction.set(null);
    }
  }

  protected async continueWithGoogle(): Promise<void> {
    if (this.activeAction()) {
      return;
    }

    this.activeAction.set('GOOGLE');
    this.errorMessage.set(null);

    try {
      await this.auth.signInWithGoogle(this.returnUrl);
    } catch {
      this.activeAction.set(null);
      this.errorMessage.set('No pudimos iniciar sesión con Google. Intentá nuevamente.');
    }
  }

  protected changeEmail(): void {
    this.sentEmail.set(null);
    this.errorMessage.set(null);
    queueMicrotask(() => document.querySelector<HTMLInputElement>('#auth-email')?.focus());
  }
}
