import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ReceiverDemoPage } from './receiver-demo.page';

const routes: Routes = [
  {
    path: '',
    component: ReceiverDemoPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ReceiverDemoPageRoutingModule {}
