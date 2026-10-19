import { TestBed } from '@angular/core/testing';

import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  beforeEach(() => localStorage.removeItem('miercoles-fc.install-prompt-dismissed'));
  afterEach(() => localStorage.removeItem('miercoles-fc.install-prompt-dismissed'));

  it('becomes eligible only after the browser provides an install prompt', () => {
    const service = TestBed.inject(PwaInstallService);
    expect(service.canInstall()).toBe(false);

    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(service.canInstall()).toBe(true);
  });

  it('remembers a dismissal', () => {
    const service = TestBed.inject(PwaInstallService);
    service.dismiss();
    expect(localStorage.getItem('miercoles-fc.install-prompt-dismissed')).toBe('true');
  });
});
