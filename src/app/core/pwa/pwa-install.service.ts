import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'miercoles-fc.install-prompt-dismissed';

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly window = this.document.defaultView;
  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly dismissed = signal(this.readDismissed());

  readonly standalone = signal(
    this.window?.matchMedia?.('(display-mode: standalone)').matches ?? false,
  );
  readonly isIos = /iphone|ipad|ipod/i.test(this.window?.navigator.userAgent ?? '');
  readonly canInstall = computed(
    () => !this.standalone() && !this.dismissed() && this.deferredPrompt() !== null,
  );
  readonly showIosHelp = computed(() => this.isIos && !this.standalone() && !this.dismissed());

  constructor() {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      this.standalone.set(true);
      this.deferredPrompt.set(null);
    };

    this.window?.addEventListener('beforeinstallprompt', onBeforeInstall);
    this.window?.addEventListener('appinstalled', onInstalled);
    this.destroyRef.onDestroy(() => {
      this.window?.removeEventListener('beforeinstallprompt', onBeforeInstall);
      this.window?.removeEventListener('appinstalled', onInstalled);
    });
  }

  async install(): Promise<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    this.deferredPrompt.set(null);
    if (choice.outcome === 'dismissed') this.dismiss();
  }

  dismiss(): void {
    this.dismissed.set(true);
    try {
      this.window?.localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // Storage can be unavailable in private/restricted browsing contexts.
    }
  }

  private readDismissed(): boolean {
    try {
      return this.window?.localStorage.getItem(DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
