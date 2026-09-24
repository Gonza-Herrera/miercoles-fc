import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

type NavigationIcon = 'home' | 'match' | 'dinner' | 'payments';

interface NavigationItem {
  readonly exact: boolean;
  readonly icon: NavigationIcon;
  readonly label: string;
  readonly route: string;
}

export const NAVIGATION_ITEMS = [
  { exact: true, icon: 'home', label: 'Inicio', route: '/' },
  { exact: false, icon: 'match', label: 'Partido', route: '/match' },
  { exact: false, icon: 'dinner', label: 'Cena', route: '/dinner' },
  { exact: false, icon: 'payments', label: 'Pagos', route: '/payments' },
] as const satisfies readonly NavigationItem[];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-bottom-navigation',
  styleUrl: './bottom-navigation.scss',
  templateUrl: './bottom-navigation.html',
})
export class BottomNavigation {
  protected readonly navigationItems = NAVIGATION_ITEMS;
}
