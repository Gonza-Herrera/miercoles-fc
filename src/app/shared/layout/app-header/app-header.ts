import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { Avatar, Button } from '../../ui';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Button, RouterLink],
  selector: 'app-header',
  styleUrl: './app-header.scss',
  templateUrl: './app-header.html',
})
export class AppHeader {
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly accountOpen = signal(false);
  protected readonly logoutError = signal<string | null>(null);
  protected readonly isSigningOut = signal(false);

  protected toggleAccount(): void {
    this.accountOpen.update((open) => !open);
    this.logoutError.set(null);
  }

  protected async signOut(): Promise<void> {
    if (this.isSigningOut()) {
      return;
    }

    this.isSigningOut.set(true);
    this.logoutError.set(null);

    try {
      await this.auth.signOut();
      this.accountOpen.set(false);
      await this.router.navigateByUrl('/auth', { replaceUrl: true });
    } catch {
      this.logoutError.set('No pudimos cerrar la sesión. Intentá nuevamente.');
    } finally {
      this.isSigningOut.set(false);
    }
  }
}
