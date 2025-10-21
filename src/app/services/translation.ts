// import { Injectable } from '@angular/core';

// @Injectable({
//   providedIn: 'root'
// })
// export class Translation {
  
// }
// src/app/services/translation.service.ts
import { Injectable } from '@angular/core';


// The plugin package name below follows the capawesome plugin exports.
// If TypeScript complains, you can `// @ts-ignore` the import and use `any`
// or add types from the plugin repo. Example from plugin docs:
import { Translation, Language } from '@capacitor-mlkit/translation';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  // Cache of downloaded languages
  private downloaded = new Set<string>();

  // preferred target language code for the ML Kit plugin (Language enum).
  // We'll download Hindi model as requested.
  readonly HINDI = Language.Hindi;

  constructor() {
    // pre-check downloaded models (non-blocking)
    this.refreshDownloadedModels().catch(() => {});
  }

  async refreshDownloadedModels(): Promise<void> {
    try {
      const res = await Translation.getDownloadedModels();
      (res.languages || []).forEach((l: any) => this.downloaded.add(String(l)));
    } catch (e) {
      // ignore
    }
  }

  async isModelDownloaded(lang: Language | string): Promise<boolean> {
    const key = String(lang);
    if (this.downloaded.has(key)) return true;
    await this.refreshDownloadedModels();
    return this.downloaded.has(key);
  }

  // Download a language model (e.g., Hindi). Returns when download completes.
  // Consider calling this on an explicit user action or when on Wi-Fi.
  async downloadModel(lang: Language | string): Promise<void> {
    const key = String(lang);
    try {
      await Translation.downloadModel({ language: (lang as any) });
      this.downloaded.add(key);
    } catch (err) {
      // propagate the error to the caller to handle UI
      throw err;
    }
  }

  // Delete a downloaded model if needed
  async deleteModel(lang: Language | string): Promise<void> {
    const key = String(lang);
    try {
      await Translation.deleteDownloadedModel({ language: (lang as any) });
      this.downloaded.delete(key);
    } catch (err) {
      throw err;
    }
  }

  // Translate text from sourceLanguage to targetLanguage.
  // ML Kit can auto-download the model if not present; we prefer to ensure it's downloaded first.
  async translateText(text: string, source: Language | string, target: Language | string): Promise<string> {
    // ensure target model is present (you can also pre-download both languages if desired)
    const targetKey = String(target);
    if (!(await this.isModelDownloaded(target))) {
      // try to download; caller UI should show progress/warn about data usage
      await this.downloadModel(target);
    }

    try {
      const res = await Translation.translate({
        text,
        sourceLanguage: (source as any),
        targetLanguage: (target as any)
      });
      return res?.text ?? text;
    } catch (err) {
      // fallback: return original text on errors
      console.warn('Translation error', err);
      return text;
    }
  }
}
