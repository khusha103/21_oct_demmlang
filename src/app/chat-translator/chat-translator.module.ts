import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ChatTranslatorPageRoutingModule } from './chat-translator-routing.module';

// import { ChatTranslatorPage } from './chat-translator.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ChatTranslatorPageRoutingModule
  ],
  declarations: []
})
export class ChatTranslatorPageModule {}
