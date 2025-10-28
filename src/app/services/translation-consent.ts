// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root'
// })
// export class TranslationConsent {
  
// }

import { Injectable } from '@angular/core';

/**
 * Service to manage user consent for translation features
 * Handles GDPR/CCPA compliance for third-party API usage
 */
@Injectable({
  providedIn: 'root'
})
export class TranslationConsent {
  private readonly CONSENT_KEY = 'translation_consent';
  private readonly CONSENT_VERSION = '1.0'; // Increment when privacy terms change

  constructor() {}

  /**
   * Check if user has granted valid consent
   * Returns false if no consent or version mismatch
   */
  hasConsent(): boolean {
    try {
      const consent = localStorage.getItem(this.CONSENT_KEY);
      if (!consent) return false;
      
      const data = JSON.parse(consent);
      
      // Check if consent is still valid (version match + granted flag)
      return data.granted === true && data.version === this.CONSENT_VERSION;
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Grant user consent with timestamp and version tracking
   */
  grantConsent(): void {
    const consent = {
      granted: true,
      version: this.CONSENT_VERSION,
      date: new Date().toISOString(),
      provider: 'Google Translate API',
      userAgent: navigator.userAgent // For audit purposes
    };
    
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(consent));
    
    // Log consent grant for audit trail (optional)
    console.log('Translation consent granted:', consent.date);
  }

  /**
   * Revoke user consent and clear data
   */
  revokeConsent(): void {
    localStorage.removeItem(this.CONSENT_KEY);
    console.log('Translation consent revoked');
  }

  /**
   * Get detailed consent information for display/export
   */
  getConsentDetails(): ConsentDetails | null {
    try {
      const consent = localStorage.getItem(this.CONSENT_KEY);
      return consent ? JSON.parse(consent) : null;
    } catch (error) {
      console.error('Error getting consent details:', error);
      return null;
    }
  }

  /**
   * Check if consent version has changed (privacy policy update)
   */
  needsConsentUpdate(): boolean {
    const details = this.getConsentDetails();
    if (!details) return true;
    
    return details.version !== this.CONSENT_VERSION;
  }

  /**
   * Update consent to new version (after policy changes)
   */
  updateConsentVersion(): void {
    const existing = this.getConsentDetails();
    if (existing) {
      const updated = {
        ...existing,
        version: this.CONSENT_VERSION,
        updatedDate: new Date().toISOString()
      };
      localStorage.setItem(this.CONSENT_KEY, JSON.stringify(updated));
    }
  }
}

/**
 * Interface for consent details
 */
export interface ConsentDetails {
  granted: boolean;
  version: string;
  date: string;
  provider: string;
  userAgent?: string;
  updatedDate?: string;
}
