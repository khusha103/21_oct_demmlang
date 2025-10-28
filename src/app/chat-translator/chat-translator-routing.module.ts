import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ChatTranslatorPage } from './chat-translator.page';

const routes: Routes = [
  {
    path: '',
    component: ChatTranslatorPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ChatTranslatorPageRoutingModule {}
