import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReceiverDemoPage } from './receiver-demo.page';

describe('ReceiverDemoPage', () => {
  let component: ReceiverDemoPage;
  let fixture: ComponentFixture<ReceiverDemoPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ReceiverDemoPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
