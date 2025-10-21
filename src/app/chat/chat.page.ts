import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

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

  // constructor() { }

  // ngOnInit() {
  // }

  @ViewChild('messagesContainer', { read: ElementRef }) messagesContainer!: ElementRef;

  lang: 'english' | 'hindi' = 'english';
  translatedView = false;
  inputText = '';

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

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  getTranslation(text: string, lang: string) {
    const map = this.translations[text];
    if (map) return (map as any)[lang] ?? text;
    return lang === 'hindi' ? 'डेमो अनुवाद: ' + text : text;
  }

  toggleTranslated() {
    this.translatedView = !this.translatedView;
    // small visual toggle could be done by class or style change
    setTimeout(() => this.scrollToBottom(), 100);
  }

  sendMessage() {
    const val = this.inputText?.trim();
    if (!val) return;
    this.thread.push({ side: 'right', text: val });
    this.translations[val] = { english: val, hindi: 'डेमो अनुवाद: ' + val };
    this.inputText = '';
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private scrollToBottom() {
    try {
      const el: HTMLElement = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch (e) { /* ignore */ }
  }

}
