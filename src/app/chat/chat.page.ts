import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslationService } from '../services/translation';
import { Language } from '@capacitor-mlkit/translation';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone:true,
  imports: [
  CommonModule,
  FormsModule,
  IonicModule]
})
export class ChatPage implements AfterViewInit {

   @ViewChild('messagesContainer', { read: ElementRef }) messagesContainer!: ElementRef;

  lang: 'english' | 'hindi' = 'english';
  translatedView = false;
  inputText = '';

  // small offline translation cache to avoid repeated ML calls for identical strings
  private runtimeCache = new Map<string, string>();

  translations: Record<string, { english: string; hindi: string; }> = {
    "Hello! How are you today?": { english: "Hello! How are you today?", hindi: "नमस्ते! आप आज कैसे हैं?" },
    "I'm doing great, thanks! How about you?": { english: "I'm doing great, thanks! How about you?", hindi: "मैं ठीक हूँ, धन्यवाद! आप कैसे हैं?" },
    "Very well, thank you. I love this translation app.": { english: "Very well, thank you. I love this translation app.", hindi: "बहुत अच्छा, धन्यवाद। मुझे यह अनुवाद ऐप पसंद है।" },
    "Right? It makes chatting with friends worldwide so easy!": { english: "Right? It makes chatting with friends worldwide so easy!", hindi: "सही कहा? यह दुनियाभर के दोस्तों के साथ चैट करना बहुत आसान बना देता है!" }
  };

  thread = [
    { side: 'left', text: "Hello! How are you today?" },
    { side: 'right', text: "I'm doing great, thanks! How about you?" },
    { side: 'left', text: "Very well, thank you. I love this translation app." },
    { side: 'right', text: "Right? It makes chatting with friends worldwide so easy!" }
  ];

  // show download status in UI
  modelDownloading = false;

  constructor(private translationService: TranslationService) {}

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  // unified translation getter — synchronous for preloaded entries, asynchronous fallback for unknown text
  async getTranslation(text: string, lang: string) {
    // prefer local dictionary first
    const map = this.translations[text];
    if (map) return (map as any)[lang] ?? text;

    // if we already cached a dynamic translation, return it
    const cacheKey = `${text}::${lang}`;
    if (this.runtimeCache.has(cacheKey)) {
      return this.runtimeCache.get(cacheKey);
    }

    // If user selected Hindi, call ML Kit translator (ensure model downloaded)
    if (lang === 'hindi') {
      try {
        // optionally show UI spinner (we set a flag)
        this.modelDownloading = true;
        const translated = await this.translationService.translateText(text, Language.English, Language.Hindi);
        this.runtimeCache.set(cacheKey, translated);
        return translated;
      } catch (e) {
        console.warn('translation failed', e);
        return 'डेमो अनुवाद: ' + text;
      } finally {
        this.modelDownloading = false;
      }
    }

    // default fallback
    return text;
  }

  toggleTranslated() {
    this.translatedView = !this.translatedView;
    setTimeout(() => this.scrollToBottom(), 100);
  }

  async sendMessage() {
    const val = this.inputText?.trim();
    if (!val) return;
    this.thread.push({ side: 'right', text: val });
    this.translations[val] = { english: val, hindi: 'डेमो अनुवाद: ' + val }; // optional
    this.inputText = '';
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom() {
    try {
      const el: HTMLElement = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (e) { /* ignore */ }
  }

  // helper UI method you can call to pre-download Hindi model on a user action
  async downloadHindiModel() {
    try {
      if (await this.translationService.isModelDownloaded(Language.Hindi)) {
        return;
      }
      this.modelDownloading = true;
      await this.translationService.downloadModel(Language.Hindi);
    } catch (err) {
      console.error('Failed to download model', err);
      // show toast/snackbar to user
    } finally {
      this.modelDownloading = false;
    }
  }

  

}
