import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent, ToastController, AlertController } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';

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
        style({ transform: 'translateY(8px)', opacity: 0 }),
        animate('180ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('120ms ease-in', style({ transform: 'translateY(8px)', opacity: 0 }))
      ])
    ])
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
    private alertCtrl: AlertController,
    private router:Router
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
// Replace existing sendTranslatedMessage() with this async version
async sendTranslatedMessage() {
  if (!this.previewActive || !this.translatedPreview?.trim()) {
    await this.showToast('No translated text to send.');
    return;
  }

  // Save edits into session history (if any)
  if (this.translationsHistory.length) {
    const last = this.translationsHistory.length - 1;
    this.translationsHistory[last].text = this.translatedPreview;
  }

  // Determine the authoritative "original" text to translate from
  const originalText = (this.originalTypedSnapshot && this.originalTypedSnapshot.trim())
    ? this.originalTypedSnapshot
    : (this.typedMessage && this.typedMessage.trim())
      ? this.typedMessage
      : this.translatedPreview; // fallback

  // Build languages array, start with Original
  const languages: LangEntry[] = [];
  if (originalText) {
    languages.push({ code: 'orig', label: 'Original', text: originalText });
  }

  // Helper to find existing entry by code in session history or languages
  const findInHist = (code: string) => {
    // check translationsHistory first (session)
    const fromHist = this.translationsHistory.find(h => (h.code || '').toLowerCase() === (code || '').toLowerCase());
    if (fromHist) return fromHist.text;
    // check previously appended languages (already in languages array)
    const fromLangs = languages.find(l => (l.code || '').toLowerCase() === (code || '').toLowerCase());
    return fromLangs ? fromLangs.text : undefined;
  };

  // 1) Ensure English reference exists (code 'en')
  let englishText = findInHist('en') || this.originalEnglishMessage || undefined;
  if (!englishText) {
    // attempt to translate originalText -> English using forced apiFromLang
    try {
      const apiFrom = this.apiFromLang;
      const resEn = await this.translateViaApi(originalText, 'en', apiFrom);
      englishText = resEn?.translatedText || undefined;
    } catch (err) {
      console.warn('English reference translation failed at send time:', err);
    }
  }
  if (englishText) {
    // Avoid duplicate if original was already English and labeled as 'orig'
    // But still provide explicit 'en' entry for reference
    languages.push({ code: 'en', label: 'English', text: englishText });
  }

  // 2) Ensure receiver translation exists (receiverLanguage)
  const recvCode = this.receiverLanguage || this.apiToLang;
  let receiverText = findInHist(recvCode) || undefined;
  if (!receiverText) {
    try {
      const apiFrom = this.apiFromLang;
      // call API to get receiver translation
      const resRecv = await this.translateViaApi(originalText, recvCode, apiFrom);
      receiverText = resRecv?.translatedText || undefined;
    } catch (err) {
      console.warn('Receiver translation failed at send time:', err);
    }
  }
  if (receiverText) {
    const recvLabel = this.languageNames[recvCode] || (recvCode || 'Receiver').toUpperCase();
    languages.push({ code: recvCode, label: recvLabel, text: receiverText });
  }

  // 3) Add the preview entry (what the user edited & intends to send)
  // Determine preview language code/label:
  const previewLangCode = this.previewTargetLangCode
    || (this.translationsHistory.length ? this.translationsHistory[this.translationsHistory.length - 1].code : undefined)
    || (this.translatedLanguage ? Object.keys(this.languageNames).find(k => this.languageNames[k] === this.translatedLanguage) : undefined)
    || 'trans'; // fallback

  const previewLabel = (this.languageNames[previewLangCode] || this.translatedLanguage || (previewLangCode || 'Translated').toUpperCase());
  // Avoid duplicating existing entry with same code: if same code exists, replace its text with edited preview
  const existingIndex = languages.findIndex(l => (l.code || '').toLowerCase() === (previewLangCode || '').toLowerCase());
  if (existingIndex >= 0) {
    languages[existingIndex].text = this.translatedPreview;
    languages[existingIndex].label = previewLabel;
  } else {
    languages.push({ code: previewLangCode, label: previewLabel, text: this.translatedPreview });
  }

  // Ensure uniqueness: collapse any duplicates (by code), keeping the last occurrence (most recent)
  const unique: LangEntry[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < languages.length; i++) {
    const codeKey = (languages[i].code || '').toLowerCase();
    // if later entries might be duplicates, we want the last occurring one; so we'll skip until rebuild in reverse
  }
  // Build unique by iterating from end -> start so last wins, then reverse
  for (let i = languages.length - 1; i >= 0; i--) {
    const key = (languages[i].code || '').toLowerCase();
    if (!seen.has(key)) {
      unique.push(languages[i]);
      seen.add(key);
    }
  }
  unique.reverse(); // restore original order but with duplicates collapsed

  // Decide which index to show by default — show the preview entry (most recent)
  const previewIndex = unique.findIndex(l => (l.code || '').toLowerCase() === (previewLangCode || '').toLowerCase());
  const defaultIndex = previewIndex >= 0 ? previewIndex : (unique.length - 1);

  // Build message
  const message: Message = {
    text: unique[defaultIndex]?.text || (unique[0]?.text || ''),
    englishText: englishText || (this.originalEnglishMessage || (originalText || '')),
    from: 'user',
    timestamp: new Date(),
    wasTranslated: true,
    translatedToLanguage: unique[defaultIndex]?.label || undefined,
    languages: unique,
    currentLangIndex: defaultIndex,
    showingEnglish: false,
  };

  // Push & persist
  this.messages.push(message);
  this.saveMessages();

  // cleanup
  this.typedMessage = '';
  this.translatedPreview = '';
  this.previewActive = false;
  this.translationsHistory = [];
  this.originalTypedSnapshot = '';
  this.originalEnglishMessage = '';
  this.resetTranslationState();

  setTimeout(() => this.scrollToBottom(), 100);
}


// Updated: sendOriginalMessage (type-safe; no res.t usage)
// Replace existing sendOriginalMessage() with this async version
async sendOriginalMessage() {
  // Use the snapshot if available, otherwise the current typed input
  const original = (this.originalTypedSnapshot && this.originalTypedSnapshot.trim()) ? this.originalTypedSnapshot : (this.typedMessage || '').trim();
  if (!original) return;

  // Build initial languages array with Original
  const languages: LangEntry[] = [
    { code: 'orig', label: 'Original', text: original }
  ];

  // Attempt to fetch translation for the receiver language
  try {
    // We want to force the API to use apiFromLang (or whatever you set) and the receiverLanguage as 'to'
    // If your translateViaApi signature differs, adapt these args accordingly.
    const apiFrom = this.apiFromLang;          // e.g. 'ja'
    const apiTo = this.receiverLanguage || this.apiToLang; // prefer per-chat receiverLanguage

    const res = await this.translateViaApi(original, apiTo, apiFrom);
    const translatedText = res?.translatedText || res?.translatedText || res?.translatedText; // defensive

    if (translatedText && translatedText.trim()) {
      const langCode = res.to || apiTo || this.receiverLanguage || 'unknown';
      const label = this.languageNames[langCode] || (langCode || 'Translated').toUpperCase();
      languages.push({
        code: langCode,
        label,
        text: translatedText
      });
    } else {
      // If API didn't return translatedText, don't block — continue with only original
      console.warn('Receiver translation returned empty.');
    }
  } catch (err) {
    // If translation fails, still send original (log for debugging / show toast optionally)
    console.error('Failed to get receiver translation at send time:', err);
    // optionally: await this.showToast('Could not translate for receiver — sending original only.');
  }

  // Create message: default shown index will be original (index 0) so sender sees original,
  // but languages[] contains receiver translation too (index 1) to toggle for review later.
  const message: Message = {
    text: languages[0].text,                 // show original by default for sender
    englishText: original,
    from: 'user',
    timestamp: new Date(),
    wasTranslated: languages.length > 1,    // true if we managed to get a receiver translation
    translatedToLanguage: languages.length > 1 ? languages[1].label : undefined,
    languages,
    currentLangIndex: 0,                    // show original by default
    showingEnglish: false,
  };

  this.messages.push(message);
  this.saveMessages();

  // cleanup session state
  this.typedMessage = '';
  this.translatedPreview = '';
  this.previewActive = false;
  this.translationsHistory = [];
  this.originalTypedSnapshot = '';
  this.originalEnglishMessage = '';
  this.resetTranslationState();

  setTimeout(() => this.scrollToBottom(), 100);
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

// Method (simplified for modules)
async goToReceiverDemo() {
  await this.showToast('Opening Receiver Demo...', 'medium');
  try {
    await this.router.navigate(['/receiver-demo'], { replaceUrl: true });
    console.log('Navigated to demo');
  } catch (err) {
    console.error('Nav error:', err);
    await this.showToast('Navigation failed—try manual URL.', 'danger');
  }
}
}