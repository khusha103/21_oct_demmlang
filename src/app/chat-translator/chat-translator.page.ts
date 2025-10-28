// import { Component, OnInit } from '@angular/core';

// @Component({
//   selector: 'app-chat-translator',
//   templateUrl: './chat-translator.page.html',
//   styleUrls: ['./chat-translator.page.scss'],
// })
// export class ChatTranslatorPage implements OnInit {

//   constructor() { }

//   ngOnInit() {
//   }

// }


import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent, ToastController } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom } from 'rxjs';

interface LangEntry {
  code: string;   // language code e.g. 'en', 'ja', 'es'
  label: string;  // human label e.g. 'English'
  text: string;   // translated text in that language
}

interface Message {
  text: string;            // cached text (kept in sync with displayed language)
  englishText: string;     // original text (if known)
  from: string;
  timestamp: Date;
  wasTranslated: boolean;
  translatedToLanguage?: string;
  languages: LangEntry[];     // ordered history of translations (first usually original)
  currentLangIndex: number;   // index into languages to show currently
  showingEnglish?: boolean;
}

@Component({
  // selector: 'app-chat',
  // templateUrl: './chat.page.html',
  // styleUrls: ['./chat.page.scss'],
   selector: 'app-chat-translator',
  templateUrl: './chat-translator.page.html',
  styleUrls: ['./chat-translator.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, HttpClientModule],
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
    ]),
  ],
})
export class ChatTranslatorPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  messages: Message[] = [];
  typedMessage: string = '';

  // per-app/chat languages
  appLanguage: string = 'en';            // user's chosen app language (my language)
  receiverLanguage: string = 'fr';      // per-chat receiver language (for UI)

  // API forcing behavior (always include from & to)
  apiFromLang: string = 'ja';           // will be sent as &from=ja
  apiToLang: string = 'es';             // will be sent as &to=es

  // UI / workflow state
  translatedLanguage: string = '';      // human label of most recent translation
  isTranslating: boolean = false;

  // Hold original typed snapshot for revert + englishText field
  originalTypedSnapshot: string = '';
  // <-- Added to match template usage and avoid TS errors:
  originalEnglishMessage: string = ''; // kept in sync with originalTypedSnapshot

  // Preview / editing
  translatedPreview: string = '';       // editable preview text for most recent translation
  previewActive: boolean = false;       // shows preview area
  previewTargetLangCode: string = '';   // code for the current preview target

  // **This session's in-progress translation history (appended each translate action)**
  translationsHistory: LangEntry[] = [];

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
  };

  constructor(private http: HttpClient, private toastCtrl: ToastController) {}

  ngOnInit() {
    const lang = localStorage.getItem('appLanguage');
    if (lang) this.appLanguage = lang;
    this.loadMessages();
  }

  // ----------------------------
  // API call: ALWAYS include from & to
  // ----------------------------
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
    // Expecting: { success:true, sourceText:"...", translatedText:"...", from:"ja", to:"es" }
    if (response?.success && response?.translatedText) {
      return {
        translatedText: response.translatedText,
        sourceText: response.sourceText,
        from: response.from,
        to: response.to,
      };
    }
    if (response?.t) {
      // backward compat
      return { translatedText: response.t };
    }
    throw new Error(response?.message || 'Translation failed');
  }

  // ----------------------------
  // Translate actions — each successful translate appends to translationsHistory
  // ----------------------------
  async translateToReceiver() {
    // Use receiverLanguage as preview target label; API uses toApiOverride = receiverLanguage so you get proper 'to' while still forcing from if desired
    await this.startTranslationFlow(this.receiverLanguage, /*fromApiOverride*/ undefined, /*toApiOverride*/ this.receiverLanguage);
  }

  async translateToMyLanguage() {
    await this.startTranslationFlow(this.appLanguage, /*fromApiOverride*/ undefined, /*toApiOverride*/ this.appLanguage);
  }

  /**
   * startTranslationFlow:
   * - targetLangCode: human label/code for UI (where translated text is intended)
   * - fromApiOverride/toApiOverride: optional overrides for the API's from/to (we default to apiFromLang/apiToLang)
   */
  private async startTranslationFlow(targetLangCode: string, fromApiOverride?: string, toApiOverride?: string) {
    if (!this.typedMessage.trim()) {
      await this.showToast('Please enter text to translate.');
      return;
    }

    // set snapshot once per typed session
    if (!this.originalTypedSnapshot) {
      this.originalTypedSnapshot = this.typedMessage;
      // keep the template-facing property in sync
      this.originalEnglishMessage = this.originalTypedSnapshot;
    }

    this.isTranslating = true;
    this.previewActive = false;
    this.previewTargetLangCode = targetLangCode;

    try {
      const apiTo = toApiOverride ?? this.apiToLang;
      const apiFrom = fromApiOverride ?? this.apiFromLang;

      // call API with forced from/to
      const res = await this.translateViaApi(this.typedMessage, apiTo, apiFrom);

      // If API returns sourceText, update snapshot so englishText is accurate
      const sourceText = res.sourceText || this.originalTypedSnapshot;

      // Build the LangEntry for this translation
      const langCode = res.to || apiTo || targetLangCode || 'unknown';
      const label = this.languageNames[langCode] || (langCode || 'Unknown').toUpperCase();
      const entry: LangEntry = {
        code: langCode,
        label,
        text: res.translatedText,
      };

      // Append to session history
      this.translationsHistory.push(entry);

      // Populate preview with the latest translation (editable)
      this.translatedPreview = entry.text;
      this.translatedLanguage = label;
      this.previewActive = true;

      // ensure originalTypedSnapshot & originalEnglishMessage updated
      this.originalTypedSnapshot = sourceText;
      this.originalEnglishMessage = sourceText;
    } catch (err: any) {
      console.error('Translation error:', err);
      await this.showToast('Translation failed. Check connection or try again.');
      this.resetTranslationState();
    } finally {
      this.isTranslating = false;
    }
  }

  // Save edits the user made in preview — updates the latest entry in translationsHistory
  savePreviewEdits() {
    if (!this.translationsHistory.length) {
      this.showToast('Nothing to save.');
      return;
    }
    // Update latest history entry with edited preview text
    const last = this.translationsHistory.length - 1;
    this.translationsHistory[last].text = this.translatedPreview;
    this.showToast('Edited translation saved for sending.');
  }

  // Revert preview to original typed text (keeps history intact but sets preview text to original)
  revertPreviewToOriginal() {
    if (this.originalTypedSnapshot) {
      this.translatedPreview = this.originalTypedSnapshot;
      this.translatedLanguage = this.languageNames['en'] || 'English';
      this.showToast('Reverted preview to original text.');
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

  // ----------------------------
  // Sending messages: include languages history on message object
  // ----------------------------
  sendTranslatedMessage() {
    if (!this.previewActive || !this.translatedPreview.trim()) {
      this.showToast('No translated text to send.');
      return;
    }

    // Ensure the latest preview edit is saved into translationsHistory
    if (this.translationsHistory.length) {
      const last = this.translationsHistory.length - 1;
      this.translationsHistory[last].text = this.translatedPreview;
    }

    // Build final languages array for the message:
    // Start with original typed snapshot (if present), then append translationsHistory entries
    const languages: LangEntry[] = [];

    if (this.originalTypedSnapshot) {
      languages.push({
        code: 'orig',
        label: 'Original',
        text: this.originalTypedSnapshot,
      });
    } else {
      // Fallback to typedMessage if no snapshot
      languages.push({
        code: 'orig',
        label: 'Original',
        text: this.typedMessage,
      });
    }

    // Append each translation from session history
    for (const h of this.translationsHistory) {
      languages.push({
        code: h.code || 'unknown',
        label: h.label || (h.code || 'Unknown').toUpperCase(),
        text: h.text,
      });
    }

    // Create message and default the displayed index to the most recent translation (last entry)
    const message: Message = {
      text: languages[languages.length - 1].text,
      englishText: this.originalTypedSnapshot || (this.typedMessage || ''),
      from: 'user',
      timestamp: new Date(),
      wasTranslated: this.translationsHistory.length > 0,
      translatedToLanguage: languages.length > 1 ? languages[languages.length - 1].label : undefined,
      languages,
      currentLangIndex: languages.length - 1,
      showingEnglish: false,
    };

    this.messages.push(message);
    this.saveMessages();

    // cleanup the input session state
    this.typedMessage = '';
    this.translatedPreview = '';
    this.previewActive = false;
    this.translationsHistory = [];
    this.originalTypedSnapshot = '';
    this.originalEnglishMessage = '';
    this.resetTranslationState();

    setTimeout(() => this.scrollToBottom(), 100);
  }

  // User chooses to send the original message (no translations)
  sendOriginalMessage() {
    const original = this.originalTypedSnapshot || this.typedMessage;
    if (!original || !original.trim()) return;

    const languages: LangEntry[] = [
      { code: 'orig', label: 'Original', text: original },
    ];

    const message: Message = {
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

  // ----------------------------
  // Toggle through all stored languages for a message (cycles)
  // ----------------------------
  toggleLanguage(messageIndex: number) {
    const msg = this.messages[messageIndex];
    if (!msg || !msg.languages || !msg.languages.length) return;

    // Advance index (wrap around)
    msg.currentLangIndex = (msg.currentLangIndex + 1) % msg.languages.length;
    // Update top-level text for compatibility
    msg.text = msg.languages[msg.currentLangIndex].text;
    // Optionally set translatedToLanguage to currently shown label
    msg.translatedToLanguage = msg.languages[msg.currentLangIndex].label;
    this.saveMessages();
  }

  // If you want to set a specific language to show (e.g., choose from a dropdown), call this:
  setMessageLanguage(messageIndex: number, langIndex: number) {
    const msg = this.messages[messageIndex];
    if (!msg || !msg.languages || !msg.languages[langIndex]) return;
    msg.currentLangIndex = langIndex;
    msg.text = msg.languages[langIndex].text;
    msg.translatedToLanguage = msg.languages[langIndex].label;
    this.saveMessages();
  }

  // ----------------------------
  // Utilities: persistence, scroll, toast
  // ----------------------------
  private resetTranslationState() {
    this.translatedLanguage = '';
    this.previewTargetLangCode = '';
    // do not clear translationsHistory here — only clear after send or explicit cancel
  }

  private saveMessages() {
    try {
      localStorage.setItem('chatMessages', JSON.stringify(this.messages));
    } catch (error) {
      console.error('Error saving messages to localStorage:', error);
    }
  }

  private loadMessages() {
    try {
      const stored = localStorage.getItem('chatMessages');
      if (stored) {
        const parsed: any[] = JSON.parse(stored);
        this.messages = parsed.map((msg: any) => {
          // Ensure languages and currentLangIndex exist for backward compatibility
          const languages = (msg.languages && msg.languages.length)
            ? msg.languages
            : [
                { code: msg.wasTranslated ? (msg.translatedToLanguage || 'trans') : 'orig', label: msg.translatedToLanguage || 'Original', text: msg.text || msg.englishText || '' }
              ];

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
        setTimeout(() => this.scrollToBottom(), 100);
      }
    } catch (error) {
      console.error('Error loading messages from localStorage:', error);
      this.messages = [];
    }
  }

  private scrollToBottom() {
    if (this.content) {
      this.content.scrollToBottom(300);
    }
  }

  private async showToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }

  // Optional: clears everything (messages + session state)
  clearAllMessages() {
    this.messages = [];
    localStorage.removeItem('chatMessages');
    this.translationsHistory = [];
    this.originalTypedSnapshot = '';
    this.originalEnglishMessage = '';
    this.translatedPreview = '';
    this.previewActive = false;
  }
}
