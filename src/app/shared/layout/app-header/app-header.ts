import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Avatar } from '../../ui';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, RouterLink],
  selector: 'app-header',
  styleUrl: './app-header.scss',
  templateUrl: './app-header.html',
})
export class AppHeader {}
