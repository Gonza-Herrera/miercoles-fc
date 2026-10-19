import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthLoading } from './core/auth/auth-loading/auth-loading';
import { AuthService } from './core/auth/auth.service';
import { ConnectivityService } from './core/network/connectivity.service';
import { AppUpdateService } from './core/pwa/app-update.service';
import { PwaInstallService } from './core/pwa/pwa-install.service';
import { RealtimeService } from './core/realtime/realtime.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthLoading, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly auth = inject(AuthService);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly install = inject(PwaInstallService);
  protected readonly update = inject(AppUpdateService);
  protected readonly realtime = inject(RealtimeService, { optional: true });
}
