import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ReceiverDemoPageRoutingModule } from './receiver-demo-routing.module';

// import { ReceiverDemoPage } from './receiver-demo.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ReceiverDemoPageRoutingModule
  ],
  declarations: []
})
export class ReceiverDemoPageModule {}
