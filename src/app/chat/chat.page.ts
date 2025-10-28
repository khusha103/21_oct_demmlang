import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent, ToastController, AlertController } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';

interface LangEntry {
  code: string;
  label: string;
  text: string;
}

interface Message {
  text: string;
  englishText: string;
  from: string;
  timestamp: Date;
  wasTranslated: boolean;
  translatedToLanguage?: string;
  languages: LangEntry[];
  currentLangIndex: number;
  showingEnglish?: boolean;
}

// Inline consent service for this example
class TranslationConsentService {
  private readonly CONSENT_KEY = 'translation_consent';
  private readonly CONSENT_VERSION = '1.0';

  hasConsent(): boolean {
    try {
      const consent = localStorage.getItem(this.CONSENT_KEY);
      if (!consent) return false;
      const data = JSON.parse(consent);
      return data.granted === true && data.version === this.CONSENT_VERSION;
    } catch { return false; }
  }

  grantConsent(): void {
    const consent = {
      granted: true,
      version: this.CONSENT_VERSION,
      date: new Date().toISOString(),
      provider: 'Google Translate API'
    };
    localStorage.setItem(this.CONSENT_KEY, JSON.stringify(consent));
  }

  revokeConsent(): void {
    localStorage.removeItem(this.CONSENT_KEY);
  }

  getConsentDetails(): any {
    try {
      const consent = localStorage.getItem(this.CONSENT_KEY);
      return consent ? JSON.parse(consent) : null;
    } catch { return null; }
  }
}

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HttpClientModule],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-in', style({ opacity: 1 })),
      ]),
    ]),
  ],
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  messages: Message[] = [];
  typedMessage: string = '';

  appLanguage: string = 'en';
  receiverLanguage: string = 'fr';
  apiFromLang: string = 'ja';
  apiToLang: string = 'es';

  translatedLanguage: string = '';
  isTranslating: boolean = false;
  originalTypedSnapshot: string = '';
  originalEnglishMessage: string = '';
  translatedPreview: string = '';
  previewActive: boolean = false;
  previewTargetLangCode: string = '';
  translationsHistory: LangEntry[] = [];

  // New UX properties
  showLanguageSelector: boolean = false;
  quickTranslateMode: boolean = false;
  autoScrollEnabled: boolean = true;
  showConsentBanner: boolean = false;

  // Consent service instance
  private consentService = new TranslationConsentService();

  readonly translateApiUrl: string =
    'https://script.google.com/macros/s/AKfycbyxnbC6LBpbtdMw2rLVqCRvqbHkT97CPQo9Ta9by1QpCMBH25BE6edivkNj5_dYp1qj/exec';

  languageNames: { [key: string]: string } = {
    hi: 'Hindi',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    en: 'English',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    ja: 'Japanese',
    zh: 'Chinese',
    ar: 'Arabic',
    pt: 'Portuguese',
    ru: 'Russian',
    ko: 'Korean',
  };

  constructor(
    private http: HttpClient, 
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    const lang = localStorage.getItem('appLanguage');
    if (lang) this.appLanguage = lang;
    
    const receiverLang = localStorage.getItem('receiverLanguage');
    if (receiverLang) this.receiverLanguage = receiverLang;
    
    this.loadMessages();
    
    // Check if we need to show consent banner
    this.showConsentBanner = !this.consentService.hasConsent();


    // Inside ngOnInit()
try {
  const pending = sessionStorage.getItem('pendingTypedMessage');
  if (pending) {
    this.typedMessage = pending;
    sessionStorage.removeItem('pendingTypedMessage');
  }
} catch (e) {
  console.warn('Failed to restore pending typed message', e);
}

  }

  // API Translation
  private async translateViaApi(text: string, toLang: string, fromLang?: string): Promise<{
    translatedText: string;
    sourceText?: string;
    from?: string;
    to?: string;
  }> {
    if (!text || !toLang) throw new Error('Missing text or target language');
    const fromParam = fromLang ?? this.apiFromLang;
    const encoded = encodeURIComponent(text);
    const url = `${this.translateApiUrl}?text=${encoded}&from=${encodeURIComponent(fromParam)}&to=${encodeURIComponent(toLang)}`;

    const response: any = await firstValueFrom(this.http.get(url));
    if (response?.success && response?.translatedText) {
      return {
        translatedText: response.translatedText,
        sourceText: response.sourceText,
        from: response.from,
        to: response.to,
      };
    }
    if (response?.t) {
      return { translatedText: response.t };
    }
    throw new Error(response?.message || 'Translation failed');
  }

  // Translation Actions - Clear separation between sender and receiver flows
  
  /**
   * SENDER translates their own message to RECEIVER's language before sending
   * This allows sender to preview/edit before sending the translation
   * REQUIRES USER CONSENT before making API call
   */
  async translateToReceiver() {
    // Privacy compliance: Check consent before translation
    if (!this.consentService.hasConsent()) {
      const granted = await this.showConsentModal();
      if (!granted) {
        await this.showToast('Translation requires your consent', 'warning');
        return;
      }
    }

    await this.startTranslationFlow(
      this.receiverLanguage, 
      this.appLanguage,  // from sender's language
      this.receiverLanguage  // to receiver's language
    );
  }

  /**
   * RECEIVER translates incoming message to THEIR language (appLanguage)
   * This is for translating messages after they arrive
   * REQUIRES USER CONSENT before making API call
   */
  async translateToMyLanguage() {
    // Privacy compliance: Check consent before translation
    if (!this.consentService.hasConsent()) {
      const granted = await this.showConsentModal();
      if (!granted) {
        await this.showToast('Translation requires your consent', 'warning');
        return;
      }
    }

    await this.startTranslationFlow(
      this.appLanguage,
      this.receiverLanguage,  // from receiver's language
      this.appLanguage  // to my language
    );
  }

  /**
   * Core translation flow with proper API parameters
   * @param targetLangCode - UI label for the target language
   * @param fromApiOverride - Source language for API (defaults to apiFromLang if not provided)
   * @param toApiOverride - Target language for API (defaults to apiToLang if not provided)
   * 
   * USAGE PATTERNS:
   * 1. Sender translating to receiver: startTranslationFlow(receiverLang, appLang, receiverLang)
   * 2. Receiver translating to self: startTranslationFlow(appLang, receiverLang, appLang)
   */
  private async startTranslationFlow(targetLangCode: string, fromApiOverride?: string, toApiOverride?: string) {
    if (!this.typedMessage.trim()) {
      await this.showToast('Please enter text to translate.', 'warning');
      return;
    }

    // Capture original text on first translate action in this session
    if (!this.originalTypedSnapshot) {
      this.originalTypedSnapshot = this.typedMessage;
      this.originalEnglishMessage = this.originalTypedSnapshot;
    }

    this.isTranslating = true;
    this.previewActive = false;
    this.previewTargetLangCode = targetLangCode;

    try {
      // Use overrides if provided, otherwise fall back to configured API languages
      const apiTo = toApiOverride ?? this.apiToLang;
      const apiFrom = fromApiOverride ?? this.apiFromLang;
      
      const res = await this.translateViaApi(this.typedMessage, apiTo, apiFrom);

      const sourceText = res.sourceText || this.originalTypedSnapshot;
      const langCode = res.to || apiTo || targetLangCode || 'unknown';
      const label = this.languageNames[langCode] || (langCode || 'Unknown').toUpperCase();
      
      const entry: LangEntry = {
        code: langCode,
        label,
        text: res.translatedText,
      };

      // Append to session translation history
      this.translationsHistory.push(entry);
      this.translatedPreview = entry.text;
      this.translatedLanguage = label;
      this.previewActive = true;
      this.originalTypedSnapshot = sourceText;
      this.originalEnglishMessage = sourceText;

      // Success feedback with clear context
      await this.showToast(`Translated to ${label} ✓`, 'success');
    } catch (err: any) {
      console.error('Translation error:', err);
      await this.showToast('Translation failed. Please check your connection.', 'danger');
      this.resetTranslationState();
    } finally {
      this.isTranslating = false;
    }
  }

  savePreviewEdits() {
    if (!this.translationsHistory.length) {
      this.showToast('Nothing to save.', 'warning');
      return;
    }
    const last = this.translationsHistory.length - 1;
    this.translationsHistory[last].text = this.translatedPreview;
    this.showToast('Translation updated', 'success');
  }

  revertPreviewToOriginal() {
    if (this.originalTypedSnapshot) {
      this.translatedPreview = this.originalTypedSnapshot;
      this.translatedLanguage = this.languageNames['en'] || 'English';
      this.showToast('Reverted to original', 'medium');
    } else {
      this.translatedPreview = '';
      this.previewActive = false;
      this.resetTranslationState();
    }
  }

  clearPreviewAndTranslation() {
    this.translatedPreview = '';
    this.previewActive = false;
    this.resetTranslationState();
  }

  
// Updated: sendTranslatedMessage — include original, sender translation, receiver translation, and receiver->English back-translation
async sendTranslatedMessage() {
  if (!this.previewActive || !this.translatedPreview.trim()) {
    this.showToast('No translated text to send.', 'warning');
    return;
  }

  // Ensure translationsHistory last entry reflects user's edited preview
  if (this.translationsHistory.length) {
    const lastIdx = this.translationsHistory.length - 1;
    this.translationsHistory[lastIdx].text = this.translatedPreview;
  }

  const languages: LangEntry[] = [];
  const originalText = this.originalTypedSnapshot || this.typedMessage || '';
  const senderTranslatedText = this.translatedPreview;
  const senderCode = this.previewTargetLangCode || (this.translationsHistory.length ? this.translationsHistory[this.translationsHistory.length - 1].code : 'trans');
  const senderLabel = this.translatedLanguage || this.languageNames[senderCode] || 'Translated';

  // 1) Original
  languages.push({
    code: 'orig',
    label: 'Original',
    text: originalText
  });

  // 2) Sender's translated preview (primary)
  languages.push({
    code: senderCode,
    label: senderLabel,
    text: senderTranslatedText
  });

  // Attempt to get or generate receiver translation (to receiverLanguage)
  const receiverCode = this.receiverLanguage;
  let receiverEntry: LangEntry | undefined = undefined;

  // Look for cached receiver translation in session history
  receiverEntry = this.translationsHistory.find(h =>
    (h.code === receiverCode || h.label === this.languageNames[receiverCode])
  );

  // If not found and receiver language differs, try on-the-fly translation (without showing loader)
  if (!receiverEntry && receiverCode && receiverCode !== senderCode) {
    // Check consent
    if (!this.consentService.hasConsent()) {
      const granted = await this.showConsentModal();
      if (!granted) {
        // Consent denied — still send message with original + sender translation only
        const msgOnly: Message = {
          text: senderTranslatedText,
          englishText: originalText,
          from: 'user',
          timestamp: new Date(),
          wasTranslated: true,
          translatedToLanguage: senderLabel,
          languages,
          currentLangIndex: 1, // sender translation index
          showingEnglish: false
        };
        this.messages.push(msgOnly);
        this.saveMessages();
        this.cleanupAfterSend();
        this.showToast('Translated message sent (receiver translation disabled)', 'success');
        if (this.autoScrollEnabled) setTimeout(() => this.scrollToBottom(), 100);
        return;
      }
    }

    // Perform graceful on-the-fly translation (do not toggle isTranslating)
    try {
      const apiFrom = this.appLanguage || this.apiFromLang || 'en';
      // Prefer translating senderTranslatedText -> receiverCode; fallback to originalText
      const textToTranslate = senderTranslatedText || originalText;
      const res = await this.translateViaApi(textToTranslate, receiverCode, apiFrom);
      const translatedText = res.translatedText ?? '';

      receiverEntry = {
        code: receiverCode,
        label: this.languageNames[receiverCode] || (receiverCode || 'Receiver').toUpperCase(),
        text: translatedText
      };

      // Cache for session
      this.translationsHistory.push(receiverEntry);
    } catch (err) {
      console.error('Receiver translation failed (silent):', err);
      receiverEntry = undefined;
      await this.showToast('Receiver translation failed — sending without it', 'warning');
    }
  }

  // 3) Attach receiver translation if present
  if (receiverEntry) {
    languages.push({
      code: receiverEntry.code || receiverCode || 'recv',
      label: receiverEntry.label || this.languageNames[receiverCode] || 'Receiver',
      text: receiverEntry.text || ''
    });

    // 4) Add receiver->English back-translation if receiver language isn't English
    const needsBackToEnglish = (receiverEntry.code && receiverEntry.code !== 'en' && receiverEntry.text);
    if (needsBackToEnglish) {
      // Attempt back-translation to English (do not toggle isTranslating)
      try {
        const backRes = await this.translateViaApi(receiverEntry.text, 'en', receiverEntry.code || undefined);
        const backEnglish = backRes.translatedText ?? '';

        if (backEnglish) {
          // label as Receiver (English)
          languages.push({
            code: 'recv_en',
            label: 'Receiver (English)',
            text: backEnglish
          });
        }
      } catch (err) {
        console.error('Back-translation to English failed (silent):', err);
        // still continue silently — not fatal
      }
    }
  }

  // Compose message: primary text should be senderTranslatedText
  const primaryIndex = languages.findIndex(l => l.text === senderTranslatedText);
  const message: Message = {
    text: senderTranslatedText,
    englishText: originalText,
    from: 'user',
    timestamp: new Date(),
    wasTranslated: true,
    translatedToLanguage: senderLabel,
    languages,
    currentLangIndex: primaryIndex >= 0 ? primaryIndex : 1, // point to sender translation if found
    showingEnglish: false,
  };

  this.messages.push(message);
  this.saveMessages();
  this.cleanupAfterSend();
  this.showToast('Translated message sent', 'success');

  if (this.autoScrollEnabled) {
    setTimeout(() => this.scrollToBottom(), 100);
  }
}

// Updated: sendOriginalMessage (type-safe; no res.t usage)
async sendOriginalMessage() {
  const original = this.originalTypedSnapshot || this.typedMessage;
  if (!original || !original.trim()) return;

  // Prepare base languages array with the original text
  const languages: LangEntry[] = [
    { code: 'orig', label: 'Original', text: original },
  ];

  const receiverCode = this.receiverLanguage;

  // Try to find a cached receiver translation in this session history
  let receiverEntry = this.translationsHistory.find(h =>
    h.code === receiverCode || h.label === this.languageNames[receiverCode]
  );

  // If no cached receiver translation, attempt an on-the-fly translation (respecting consent)
  if (!receiverEntry && receiverCode && receiverCode !== this.appLanguage) {
    // Check consent
    if (!this.consentService.hasConsent()) {
      const granted = await this.showConsentModal();
      if (!granted) {
        // User declined consent — send original only
        const messageOnly: Message = {
          text: original,
          englishText: original,
          from: 'user',
          timestamp: new Date(),
          wasTranslated: false,
          translatedToLanguage: undefined,
          languages,
          currentLangIndex: 0,
          showingEnglish: false,
        };
        this.messages.push(messageOnly);
        this.saveMessages();
        this.cleanupAfterSend();
        this.showToast('Message sent (translation disabled)', 'medium');
        if (this.autoScrollEnabled) setTimeout(() => this.scrollToBottom(), 100);
        return;
      }
    }

    // Perform translation call
    // this.isTranslating = true;
    try {
      // Use appLanguage as source (fallback to apiFromLang), and receiverCode as target
      const apiFrom = this.appLanguage || this.apiFromLang;
      const res = await this.translateViaApi(original, receiverCode, apiFrom);

      // TYPE-SAFE: use translatedText only (translateViaApi guarantees this field)
      const translatedText = res.translatedText ?? '';
      const label = this.languageNames[receiverCode] || (receiverCode || 'Translated').toUpperCase();

      receiverEntry = {
        code: receiverCode,
        label,
        text: translatedText
      };

      // cache it in session history for later
      this.translationsHistory.push(receiverEntry);
    } catch (err) {
      console.error('Receiver translation failed:', err);
      // proceed without receiver translation (send original only)
      receiverEntry = undefined;
      await this.showToast('Receiver translation failed — sent original', 'warning');
    } finally {
      // this.isTranslating = false;
    }
  }

  // If we have a receiver translation (either cached or just created), attach it
  if (receiverEntry) {
    languages.push({
      code: receiverEntry.code || receiverCode || 'trans',
      label: receiverEntry.label || this.languageNames[receiverCode] || 'Translated',
      text: receiverEntry.text || ''
    });
  }

  const message: Message = {
    text: original,                      // primary shown text remains the original
    englishText: original,
    from: 'user',
    timestamp: new Date(),
    wasTranslated: !!receiverEntry,      // mark translated if we attached a receiver translation
    translatedToLanguage: receiverEntry ? (receiverEntry.label || this.languageNames[receiverCode]) : undefined,
    languages,
    currentLangIndex: 0,                 // show Original by default
    showingEnglish: false,
  };

  this.messages.push(message);
  this.saveMessages();
  this.cleanupAfterSend();
  this.showToast(receiverEntry ? 'Message sent with receiver translation' : 'Message sent', 'success');

  if (this.autoScrollEnabled) {
    setTimeout(() => this.scrollToBottom(), 100);
  }
}



  private cleanupAfterSend() {
    this.typedMessage = '';
    this.translatedPreview = '';
    this.previewActive = false;
    this.translationsHistory = [];
    this.originalTypedSnapshot = '';
    this.originalEnglishMessage = '';
    this.resetTranslationState();
  }

  toggleLanguage(messageIndex: number) {
    const msg = this.messages[messageIndex];
    if (!msg || !msg.languages || !msg.languages.length) return;

    msg.currentLangIndex = (msg.currentLangIndex + 1) % msg.languages.length;
    msg.text = msg.languages[msg.currentLangIndex].text;
    msg.translatedToLanguage = msg.languages[msg.currentLangIndex].label;
    this.saveMessages();
  }

  setMessageLanguage(messageIndex: number, langIndex: number) {
    const msg = this.messages[messageIndex];
    if (!msg || !msg.languages || !msg.languages[langIndex]) return;
    msg.currentLangIndex = langIndex;
    msg.text = msg.languages[langIndex].text;
    msg.translatedToLanguage = msg.languages[langIndex].label;
    this.saveMessages();
  }

  // New UX methods
  async copyMessageText(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      await this.showToast('Copied to clipboard', 'success');
    } catch (err) {
      await this.showToast('Failed to copy', 'danger');
    }
  }

  deleteMessage(index: number) {
    this.messages.splice(index, 1);
    this.saveMessages();
    this.showToast('Message deleted', 'medium');
  }

  setReceiverLanguage(langCode: string) {
    this.receiverLanguage = langCode;
    localStorage.setItem('receiverLanguage', langCode);
    this.showToast(`Receiver language set to ${this.languageNames[langCode]}`, 'success');
  }

  toggleQuickTranslate() {
    this.quickTranslateMode = !this.quickTranslateMode;
    const mode = this.quickTranslateMode ? 'enabled' : 'disabled';
    this.showToast(`Quick translate ${mode}`, 'medium');
  }

  private resetTranslationState() {
    this.translatedLanguage = '';
    this.previewTargetLangCode = '';
  }

  private saveMessages() {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(this.messages));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  }

  private loadMessages() {
    try {
      const stored = localStorage.getItem('chatMessages');
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        this.messages = parsed.map((msg: any) => {
          const languages = (msg.languages && msg.languages.length)
            ? msg.languages
            : [{ 
                code: msg.wasTranslated ? (msg.translatedToLanguage || 'trans') : 'orig', 
                label: msg.translatedToLanguage || 'Original', 
                text: msg.text || msg.englishText || '' 
              }];

          const currentLangIndex = (typeof msg.currentLangIndex === 'number')
            ? msg.currentLangIndex
            : languages.length - 1;

          return {
            ...msg,
            languages,
            currentLangIndex,
            timestamp: new Date(msg.timestamp),
            showingEnglish: false,
            text: languages[currentLangIndex].text,
            englishText: msg.englishText || (languages[0] ? languages[0].text : ''),
          } as Message;
        });
        
        if (this.autoScrollEnabled) {
          setTimeout(() => this.scrollToBottom(), 100);
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      this.messages = [];
    }
  }

  private scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  private async showToast(message: string, color: string = 'medium') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
      color,
    });
    await toast.present();
  }


   clearAllMessages() {
    this.messages = [];
    localStorage.removeItem('chatMessages');
    this.translationsHistory = [];
    this.originalTypedSnapshot = '';
    this.originalEnglishMessage = '';
    this.translatedPreview = '';
    this.previewActive = false;
    this.showToast('All messages cleared', 'medium');
  }

  // ===== PRIVACY & COMPLIANCE METHODS =====

  /**
   * Show privacy consent modal before first translation
   * Required for GDPR/CCPA compliance
   */
  async showConsentModal(): Promise<boolean> {
    const alert = await this.alertCtrl.create({
      header: '🌐 Translation Privacy',
      message: `
        <div style="text-align: left; font-size: 14px;">
          <p>To provide translations, we use <strong>Google Translate API</strong>.</p>
          
          <p><strong>What happens:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>Your message is sent to Google securely</li>
            <li>Google translates and returns the text</li>
            <li>No personal information is shared</li>
          </ul>
          
          <p><strong>Your rights:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px;">
            <li>You can disable translations anytime</li>
            <li>Your data is not sold or shared</li>
            <li>You can delete your data anytime</li>
          </ul>
          
          <p style="font-size: 12px; color: #666; margin-top: 12px;">
            <a href="https://policies.google.com/privacy" target="_blank" style="color: #3880ff;">Google Privacy Policy</a>
          </p>
        </div>
      `,
      cssClass: 'consent-alert',
      backdropDismiss: false,
      buttons: [
        {
          text: 'Not Now',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'I Understand',
          role: 'confirm',
          cssClass: 'primary',
          handler: () => {
            this.consentService.grantConsent();
            this.showConsentBanner = false;
            return true;
          }
        }
      ]
    });

    await alert.present();
    const { role } = await alert.onDidDismiss();
    
    return role === 'confirm';
  }

  /**
   * Grant consent from banner (inline consent option)
   */
  // grantConsent() {
  //   this.consentService.grantConsent();
  //   this.showConsentBanner = false;
  //   this.showToast('Translation enabled', 'success');
  // }

  // ✅ Updated grantConsent() — saves typed message and reloads UI
grantConsent() {
  try {
    // Preserve current typed message (if any) before reload
    if (this.typedMessage && this.typedMessage.trim()) {
      sessionStorage.setItem('pendingTypedMessage', this.typedMessage);
    } else {
      sessionStorage.removeItem('pendingTypedMessage');
    }
  } catch (e) {
    console.warn('Could not preserve typed message before reload', e);
  }

  // Grant translation consent and hide banner
  this.consentService.grantConsent();
  this.showConsentBanner = false;
  this.showToast('Translation enabled', 'success');

  // Reload app to refresh UI and show translation input/options immediately
  setTimeout(() => {
    location.replace(location.href);
  }, 400);
}


  /**
   * Decline consent and hide banner
   */
  declineConsent() {
    this.showConsentBanner = false;
    this.showToast('You can enable translations later in settings', 'medium');
  }

  /**
   * Open privacy policy in new window
   */
  openPrivacyPolicy() {
    window.open('https://policies.google.com/privacy', '_blank');
  }

  /**
   * Show detailed privacy information
   */
  async showPrivacyInfo() {
    const consentDetails = this.consentService.getConsentDetails();
    const consentDate = consentDetails ? new Date(consentDetails.date).toLocaleString() : 'Not granted';
    
    const alert = await this.alertCtrl.create({
      header: 'Translation Privacy',
      message: `
        <div style="text-align: left; font-size: 13px;">
          <p><strong>Current Status:</strong></p>
          <p>Consent: ${this.consentService.hasConsent() ? '✓ Granted' : '✗ Not granted'}</p>
          <p>Date: ${consentDate}</p>
          
          <hr style="margin: 12px 0;">
          
          <p><strong>How It Works:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px; font-size: 12px;">
            <li>Messages sent to Google Translate API via HTTPS</li>
            <li>Google processes and returns translation</li>
            <li>We store translations locally on your device</li>
            <li>No data sent to our servers</li>
          </ul>
          
          <p><strong>Your Data:</strong></p>
          <ul style="margin: 8px 0; padding-left: 20px; font-size: 12px;">
            <li>Export your translation history</li>
            <li>Delete all translations anytime</li>
            <li>Revoke consent in settings</li>
          </ul>
        </div>
      `,
      buttons: ['Close']
    });
    
    await alert.present();
  }

  /**
   * Revoke translation consent
   */
  async revokeConsent() {
    const alert = await this.alertCtrl.create({
      header: 'Revoke Consent',
      message: 'This will disable translation features. You can re-enable them anytime.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Revoke',
          role: 'destructive',
          handler: () => {
            this.consentService.revokeConsent();
            this.showConsentBanner = true;
            this.showToast('Translation consent revoked', 'medium');
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Clear all translation data (GDPR right to erasure)
   */
  async clearTranslationData() {
    const alert = await this.alertCtrl.create({
      header: 'Clear Translation Data',
      message: 'This will remove all translated messages from this device. Original messages will remain. Continue?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: () => {
            // Keep only original language versions
            this.messages = this.messages.map(msg => ({
              ...msg,
              languages: msg.languages.length > 0 ? [msg.languages[0]] : [],
              currentLangIndex: 0,
              wasTranslated: false,
              translatedToLanguage: undefined
            }));
            this.saveMessages();
            this.showToast('Translation data cleared', 'success');
          }
        }
      ]
    });
    
    await alert.present();
  }

  /**
   * Export translation data (GDPR right to data portability)
   */
  async exportTranslationData() {
    const consentDetails = this.consentService.getConsentDetails();
    const translatedMessages = this.messages.filter(m => m.wasTranslated);
    
    // Get all unique language codes from messages
    const allLanguageCodes: string[] = [];
    this.messages.forEach((msg: Message) => {
      msg.languages.forEach((lang: LangEntry) => {
        if (!allLanguageCodes.includes(lang.code)) {
          allLanguageCodes.push(lang.code);
        }
      });
    });
    
    const exportData = {
      exportDate: new Date().toISOString(),
      appVersion: '1.0.0',
      consent: consentDetails,
      statistics: {
        totalMessages: this.messages.length,
        translatedMessages: translatedMessages.length,
        languages: allLanguageCodes
      },
      messages: translatedMessages.map((msg: Message) => ({
        timestamp: msg.timestamp,
        languages: msg.languages,
        wasTranslated: msg.wasTranslated
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `translation-data-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('Data exported successfully', 'success');
  }

  /**
   * Check if translations are enabled (has consent)
   */
  get translationsEnabled(): boolean {
    return this.consentService.hasConsent();
  }

  /**
   * Get consent date for display
   */
  get consentDate(): Date | null {
    const details = this.consentService.getConsentDetails();
    return details ? new Date(details.date) : null;
  }
}