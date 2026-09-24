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
  selector: 'app-design-system-showcase',
  styleUrl: './design-system-showcase.scss',
  templateUrl: './design-system-showcase.html',
})
export class DesignSystemShowcase {}
