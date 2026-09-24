import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeader } from '../app-header/app-header';
import { BottomNavigation } from '../bottom-navigation/bottom-navigation';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, BottomNavigation, RouterOutlet],
  selector: 'app-shell',
  styleUrl: './app-shell.scss',
  templateUrl: './app-shell.html',
})
export class AppShell {}
