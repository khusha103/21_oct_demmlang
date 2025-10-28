import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatTranslatorPage } from './chat-translator.page';

describe('ChatTranslatorPage', () => {
  let component: ChatTranslatorPage;
  let fixture: ComponentFixture<ChatTranslatorPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ChatTranslatorPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
