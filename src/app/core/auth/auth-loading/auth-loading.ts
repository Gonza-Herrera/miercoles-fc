import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-auth-loading',
  styleUrl: './auth-loading.scss',
  templateUrl: './auth-loading.html',
})
export class AuthLoading {
  readonly message = input('Preparando tu miércoles…');
}
