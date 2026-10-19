import { TestBed } from '@angular/core/testing';

import { ConnectivityService, OfflineOperationError } from './connectivity.service';

describe('ConnectivityService', () => {
  it('exposes the browser connectivity state', () => {
    const service = TestBed.inject(ConnectivityService);
    expect(service.online()).toBe(navigator.onLine);
  });

  it('rejects online-only operations when offline', () => {
    const service = TestBed.inject(ConnectivityService);
    service.online.set(false);
    expect(() => service.requireOnline()).toThrow(OfflineOperationError);
  });
});
