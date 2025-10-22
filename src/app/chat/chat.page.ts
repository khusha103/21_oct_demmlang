import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule, IonContent } from '@ionic/angular';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { trigger, transition, style, animate } from '@angular/animations';

interface Message {
  text: string; // Translated text or original English
  englishText: string; // Original English text (always stored)
  from: string;
  timestamp: Date;
  wasTranslated: boolean; // True if message was sent with translation
  translatedToLanguage?: string; // e.g., "Hindi", "French"
  showingEnglish?: boolean; // UI state for toggle
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
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class ChatPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  messages: Message[] = [];
  typedMessage: string = '';
  appLanguage: string = 'en';
  translatedLanguage: string = '';
  isTranslating: boolean = false;
  originalEnglishMessage: string = ''; // Store original before translation

  readonly translateApiUrl: string =
    'https://script.google.com/macros/s/AKfycbz-X8ZFe5VFDPq0rRBdL65OrIghLFEw3yQXQiS03sQohoGo_cMpx8l27OCmtQpyFkz_/exec';

  languageNames: { [key: string]: string } = {
    hi: 'Hindi',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    en: 'English',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const lang = localStorage.getItem('appLanguage');
    if (lang) this.appLanguage = lang;

    // Load messages from localStorage
    this.loadMessages();
  }

  async translateMessage() {
    if (!this.typedMessage.trim()) return;

    // Store original English text before translation
    this.originalEnglishMessage = this.typedMessage;
    this.isTranslating = true;

    const encodedText = encodeURIComponent(this.typedMessage);
    const url = `${this.translateApiUrl}?text=${encodedText}&lang=${this.appLanguage}`;

    try {
      const response: any = await this.http.get(url).toPromise();

      if (response?.t) {
        this.typedMessage = response.t;
        this.translatedLanguage =
          this.languageNames[this.appLanguage] || this.appLanguage.toUpperCase();
      } else {
        this.showToast('Translation failed. Please try again.');
        this.translatedLanguage = '';
        this.originalEnglishMessage = '';
      }
    } catch (err) {
      console.error('Translation error:', err);
      this.showToast('Error while translating. Check your connection.');
      this.translatedLanguage = '';
      this.originalEnglishMessage = '';
    } finally {
      this.isTranslating = false;
    }
  }

  clearTranslation() {
    // Restore original English message
    if (this.originalEnglishMessage) {
      this.typedMessage = this.originalEnglishMessage;
    }
    this.translatedLanguage = '';
    this.originalEnglishMessage = '';
  }

  sendMessage() {
    if (!this.typedMessage.trim() || this.isTranslating) return;

    const message: Message = {
      text: this.typedMessage, // This is the translated text or original
      englishText: this.originalEnglishMessage || this.typedMessage, // Always store English
      from: 'user',
      timestamp: new Date(),
      wasTranslated: !!this.translatedLanguage, // True if translated
      translatedToLanguage: this.translatedLanguage || undefined,
      showingEnglish: false, // By default show translated version
    };

    this.messages.push(message);

    // Save to localStorage
    this.saveMessages();

    // Reset
    this.typedMessage = '';
    this.translatedLanguage = '';
    this.originalEnglishMessage = '';

    // Scroll to bottom after message is added
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  toggleLanguage(index: number) {
    if (this.messages[index].wasTranslated) {
      this.messages[index].showingEnglish = !this.messages[index].showingEnglish;
      
      // Save state to localStorage
      this.saveMessages();
    }
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
        this.messages = JSON.parse(stored);
        
        // Convert timestamp strings back to Date objects
        this.messages = this.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          showingEnglish: false // Reset toggle state on load
        }));

        // Scroll to bottom after loading
        setTimeout(() => {
          this.scrollToBottom();
        }, 100);
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

  private showToast(message: string) {
    // You can implement a proper toast notification here
    console.log(message);
  }

  // Optional: Add method to clear all messages
  clearAllMessages() {
    this.messages = [];
    localStorage.removeItem('chatMessages');
  }
}