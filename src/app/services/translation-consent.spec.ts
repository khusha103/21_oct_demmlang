import { TestBed } from '@angular/core/testing';

import { TranslationConsent } from './translation-consent';

describe('TranslationConsent', () => {
  let service: TranslationConsent;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationConsent);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
