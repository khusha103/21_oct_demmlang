// import { Component, OnInit } from '@angular/core';

// @Component({
//   selector: 'app-receiver-demo',
//   templateUrl: './receiver-demo.page.html',
//   styleUrls: ['./receiver-demo.page.scss'],
// })
// export class ReceiverDemoPage implements OnInit {

//   constructor() { }

//   ngOnInit() {
//   }

// }

import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
// ✅ Correct
import { IonicModule, IonContent, ToastController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';  // Add this line
import { trigger, transition, style, animate } from '@angular/animations';
import { KeyValuePipe } from '@angular/common';  // For | keyvalue pipe

// Reuse your interfaces from chat.page.ts (copy if not shared)
interface LangEntry {
  code: string;
  label: string;
  text: string;
}

interface Message {
  text: string;
  englishText: string;
  from: string;  // 'sender' for demo
  timestamp: Date;
  wasTranslated: boolean;
  translatedToLanguage?: string;
  languages: LangEntry[];
  currentLangIndex: number;
  showingEnglish?: boolean;
}

@Component({
  selector: 'app-receiver-demo',
  templateUrl: './receiver-demo.page.html',
  styleUrls: ['./receiver-demo.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule, KeyValuePipe],
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
export class ReceiverDemoPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;

  demoMessages: Message[] = [];
  additionalDemoMessages: Message[] = [];

  appLanguage: string = 'fr';  // Receiver's language: French (customize in ngOnInit)
  receiverLanguage: string = 'en';  // Sender's language: English

  showLanguageSelector: boolean = false;
  autoScrollEnabled: boolean = true;

  languageNames: { [key: string]: string } = {
    en: 'English',
    fr: 'French',
    es: 'Spanish',
    de: 'German',
    hi: 'Hindi',
    ja: 'Japanese',
    zh: 'Chinese',
    ar: 'Arabic',
    pt: 'Portuguese',
    ru: 'Russian',
    ko: 'Korean',
  };

  constructor(
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
    private router: Router  // For navigation
  ) {}

  ngOnInit() {
    // Optional: Load from localStorage or set defaults
    const savedReceiverLang = localStorage.getItem('demoReceiverLanguage');
    if (savedReceiverLang) this.appLanguage = savedReceiverLang;
    const savedSenderLang = localStorage.getItem('demoSenderLanguage');
    if (savedSenderLang) this.receiverLanguage = savedSenderLang;

    this.initializeDemoMessages();
    if (this.autoScrollEnabled) {
      setTimeout(() => this.scrollToBottom(), 100);
    }
  }

  private initializeDemoMessages() {
    // Demo Message 1: Translated from Sender to Receiver
    this.demoMessages = [
      {
        text: this.translateSample('Hello, how are you?', this.receiverLanguage, this.appLanguage),  // Default: Receiver's lang
        englishText: 'Hello, how are you?',
        from: 'sender',
        timestamp: new Date(Date.now() - 5 * 60 * 1000),
        wasTranslated: true,
        translatedToLanguage: this.languageNames[this.appLanguage],
        languages: [
          { code: this.receiverLanguage, label: `Original (${this.languageNames[this.receiverLanguage]})`, text: 'Hello, how are you?' },
          { code: this.appLanguage, label: `Translated (${this.languageNames[this.appLanguage]})`, text: this.translateSample('Hello, how are you?', this.receiverLanguage, this.appLanguage) },
          { code: 'back_en', label: 'Back to English', text: 'Hello, how are you?' }
        ],
        currentLangIndex: 1,
        showingEnglish: false,
      },
      // Add more as needed
    ];

    this.additionalDemoMessages = [
      // Untranslated example
      {
        text: 'See you later!',
        englishText: 'See you later!',
        from: 'sender',
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
        wasTranslated: false,
        languages: [{ code: this.receiverLanguage, label: `Original (${this.languageNames[this.receiverLanguage]})`, text: 'See you later!' }],
        currentLangIndex: 0,
        showingEnglish: false,
      }
    ];
  }

  // Simple sample translator (replace with your API if needed for real demo)
  private translateSample(text: string, from: string, to: string): string {
    const samples: { [key: string]: { [key: string]: string } } = {
      en: {
        fr: 'Bonjour, comment allez-vous ?',
        es: '¿Hola, cómo estás?',
      },
      // Add more pairs
    };
    return samples[from]?.[to] || text;  // Fallback to original
  }

  simulateNewMessage() {
    const newMsg: Message = {
      text: this.translateSample('Thanks for the coffee!', this.receiverLanguage, this.appLanguage),
      englishText: 'Thanks for the coffee!',
      from: 'sender',
      timestamp: new Date(),
      wasTranslated: true,
      translatedToLanguage: this.languageNames[this.appLanguage],
      languages: [
        { code: this.receiverLanguage, label: `Original (${this.languageNames[this.receiverLanguage]})`, text: 'Thanks for the coffee!' },
        { code: this.appLanguage, label: `Translated (${this.languageNames[this.appLanguage]})`, text: this.translateSample('Thanks for the coffee!', this.receiverLanguage, this.appLanguage) },
        { code: 'back_en', label: 'Back to English', text: 'Thanks for the coffee!' }
      ],
      currentLangIndex: 1,
      showingEnglish: false,
    };

    this.additionalDemoMessages.push(newMsg);
    this.showToast('New message received!', 'success');
    if (this.autoScrollEnabled) setTimeout(() => this.scrollToBottom(), 100);
  }

  toggleLanguage(messageIndex: number) {
    let messagesArray = this.demoMessages;
    let i = messageIndex;
    if (messageIndex >= this.demoMessages.length) {
      messagesArray = this.additionalDemoMessages;
      i = messageIndex - this.demoMessages.length;
    }

    const msg = messagesArray[i];
    if (!msg?.languages?.length) return;

    msg.currentLangIndex = (msg.currentLangIndex + 1) % msg.languages.length;
    msg.text = msg.languages[msg.currentLangIndex].text;
    msg.translatedToLanguage = msg.languages[msg.currentLangIndex].label;
  }

  async copyMessageText(message: Message) {
    try {
      await navigator.clipboard.writeText(message.text);
      await this.showToast('Copied to clipboard', 'success');
    } catch {
      await this.showToast('Failed to copy', 'danger');
    }
  }

  clearAllMessages() {
    this.demoMessages = [];
    this.additionalDemoMessages = [];
    this.showToast('Demo cleared', 'medium');
  }

  async showPrivacyInfo() {
    const alert = await this.alertCtrl.create({
      header: 'Translation Privacy (Receiver View)',
      message: `
        <p>As the receiver, you see messages translated to your language (${this.languageNames[this.appLanguage]}).</p>
        <p>Toggle languages using the swap icon. All data stays local—no server storage.</p>
        <ul>
          <li>Original: Sender's ${this.languageNames[this.receiverLanguage]}</li>
          <li>Translated: Your version</li>
          <li>Back-Translation: English for clarity</li>
        </ul>
      `,
      buttons: ['Close']
    });
    await alert.present();
  }

  private scrollToBottom() {
    this.content.scrollToBottom(300);
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


// Method (simplified for modules)
async goTochat() {
 
    await this.router.navigate(['/chat'], { replaceUrl: true });
   
}
}
