import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Provider } from '@angular/core';
import { AppComponent } from './app/app.component';

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.log(err));

  bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations() // <-- add this
  ]
});
function bootstrapApplication(AppComponent: any, arg1: { providers: Provider[][]; }) {
  throw new Error('Function not implemented.');
}

