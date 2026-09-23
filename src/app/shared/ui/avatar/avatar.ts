import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AvatarSize = 'small' | 'medium' | 'large';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-avatar',
  styleUrl: './avatar.scss',
  templateUrl: './avatar.html',
})
export class Avatar {
  readonly name = input.required<string>();
  readonly src = input<string | null>(null);
  readonly alt = input<string>();
  readonly size = input<AvatarSize>('medium');

  protected readonly initials = computed(() => {
    const words = this.name().trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
      return '?';
    }

    const firstInitial = words[0].charAt(0);
    const lastInitial = words.length > 1 ? words.at(-1)?.charAt(0) : '';

    return `${firstInitial}${lastInitial}`.toLocaleUpperCase();
  });

  protected readonly imageAlt = computed(() => this.alt() ?? this.name());
}
