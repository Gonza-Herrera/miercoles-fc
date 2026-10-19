import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  it('offers a ready version without forcing a reload', () => {
    const versionUpdates = new Subject<object>();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            activateUpdate: vi.fn(),
            isEnabled: true,
            unrecoverable: new Subject<object>(),
            versionUpdates,
          },
        },
      ],
    });
    const service = TestBed.inject(AppUpdateService);

    versionUpdates.next({
      currentVersion: { hash: 'old' },
      latestVersion: { hash: 'new' },
      type: 'VERSION_READY',
    });

    expect(service.available()).toBe(true);
    service.dismiss();
    expect(service.available()).toBe(false);
  });
});
