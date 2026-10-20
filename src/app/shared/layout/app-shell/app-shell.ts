import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

import { NavigationContextService } from '../../../core/navigation/navigation-context.service';
import { AppHeader } from '../app-header/app-header';
import { BottomNavigation } from '../bottom-navigation/bottom-navigation';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, BottomNavigation, RouterLink, RouterOutlet],
  selector: 'app-shell',
  styleUrl: './app-shell.scss',
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected readonly navigation = inject(NavigationContextService);
}
