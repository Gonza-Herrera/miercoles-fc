import { ChangeDetectionStrategy, Component } from '@angular/core';

import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  ProgressBar,
} from '../../shared/ui';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Avatar, Badge, Button, Card, Chip, Divider, EmptyState, IconButton, ProgressBar],
  selector: 'app-home',
  styleUrl: './home.scss',
  templateUrl: './home.html',
})
export class Home {}
