import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthLoading } from '../../../core/auth/auth-loading/auth-loading';
import { normalizeReturnUrl } from '../../../core/auth/auth-redirect';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLoading, RouterLink],
  selector: 'app-auth-callback',
  styleUrl: './auth-callback.scss',
  templateUrl: './auth-callback.html',
})
export class AuthCallback implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.auth.initialize();

    if (this.auth.isAuthenticated()) {
      await this.router.navigateByUrl(
        normalizeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
        { replaceUrl: true },
      );
      return;
    }

    this.errorMessage.set('El enlace no es válido o ya venció. Solicitá uno nuevo para ingresar.');
  }
}
