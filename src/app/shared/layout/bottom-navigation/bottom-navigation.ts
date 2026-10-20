import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  AppSection,
  NavigationContextService,
} from '../../../core/navigation/navigation-context.service';

type NavigationIcon = 'home' | 'match' | 'dinner' | 'payments';

interface NavigationItem {
  readonly icon: NavigationIcon;
  readonly label: string;
  readonly route: string;
  readonly section: AppSection;
}

export const NAVIGATION_ITEMS = [
  { icon: 'home', label: 'Inicio', route: '/', section: 'HOME' },
  { icon: 'match', label: 'Partido', route: '/match', section: 'MATCH' },
  { icon: 'dinner', label: 'Cena', route: '/dinner', section: 'DINNER' },
  { icon: 'payments', label: 'Pagos', route: '/payments', section: 'PAYMENTS' },
] as const satisfies readonly NavigationItem[];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  selector: 'app-bottom-navigation',
  styleUrl: './bottom-navigation.scss',
  templateUrl: './bottom-navigation.html',
})
export class BottomNavigation {
  protected readonly context = inject(NavigationContextService);
  protected readonly navigationItems = NAVIGATION_ITEMS;
}
