import '@testing-library/jest-dom';
import { vi, expect, afterEach } from 'vitest';
import { TextEncoder, TextDecoder } from 'util';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

// Mock fetch globally
global.fetch = vi.fn();

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

// Add TextEncoder/Decoder to global
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock EventSource for behavior testing
class MockEventSource implements EventSource {
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readonly withCredentials: boolean = false;
  url: string;
  readyState: number = this.CONNECTING;
  onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null;
  onerror: ((this: EventSource, ev: Event) => any) | null = null;
  onopen: ((this: EventSource, ev: Event) => any) | null = null;
  private messageListeners: ((this: EventSource, ev: MessageEvent) => any)[] =
    [];
  private errorListeners: ((this: EventSource, ev: Event) => any)[] = [];
  private openListeners: ((this: EventSource, ev: Event) => any)[] = [];

  constructor(url: string | URL, eventSourceInitDict?: EventSourceInit) {
    this.url = url.toString();
    if (eventSourceInitDict?.withCredentials) {
      this.withCredentials = eventSourceInitDict.withCredentials;
    }
    // Simulate successful connection by default
    setTimeout(() => this.simulateOpen(), 0);
    // Track this instance for testing
    MockEventSource.lastInstance = this;
  }

  addEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    switch (type) {
      case 'message':
        this.messageListeners.push(
          listener as (this: EventSource, ev: MessageEvent) => any
        );
        break;
      case 'error':
        this.errorListeners.push(
          listener as (this: EventSource, ev: Event) => any
        );
        break;
      case 'open':
        this.openListeners.push(
          listener as (this: EventSource, ev: Event) => any
        );
        break;
    }
  }

  removeEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (this: EventSource, ev: EventSourceEventMap[K]) => any,
    options?: boolean | EventListenerOptions
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    switch (type) {
      case 'message':
        this.messageListeners = this.messageListeners.filter(
          cb => cb !== listener
        );
        break;
      case 'error':
        this.errorListeners = this.errorListeners.filter(cb => cb !== listener);
        break;
      case 'open':
        this.openListeners = this.openListeners.filter(cb => cb !== listener);
        break;
    }
  }

  close(): void {
    this.readyState = this.CLOSED;
  }

  dispatchEvent(event: Event): boolean {
    return true;
  }

  // Test helper methods
  private simulateOpen(): void {
    this.readyState = this.OPEN;
    const event = new Event('open');
    if (this.onopen) this.onopen.call(this, event);
    this.openListeners.forEach(listener => listener.call(this, event));
  }

  private dispatchMessage(data: any): void {
    const event = new MessageEvent('message', { data: JSON.stringify(data) });
    if (this.onmessage) this.onmessage.call(this, event);
    this.messageListeners.forEach(listener => listener.call(this, event));
  }

  private dispatchError(error?: any): void {
    const event = new Event('error');
    if (this.onerror) this.onerror.call(this, event);
    this.errorListeners.forEach(listener => listener.call(this, event));
  }

  // Static test methods
  static simulateResponse(content: string): void {
    const instance = MockEventSource.lastInstance;
    if (instance) {
      instance.dispatchMessage({ type: 'content', content });
      instance.dispatchMessage({ type: 'done' });
      instance.close();
    }
  }

  static simulateConnectionError(): void {
    const instance = MockEventSource.lastInstance;
    if (instance) {
      instance.readyState = instance.CONNECTING;
      instance.dispatchError();
      instance.close();
    }
  }

  static simulateServerError(errorMessage: string): void {
    const instance = MockEventSource.lastInstance;
    if (instance) {
      instance.dispatchMessage({ type: 'error', error: errorMessage });
      instance.close();
    }
  }

  // Keep track of the last created instance for static test methods
  private static lastInstance: MockEventSource | null = null;

  static {
    // Reset the last instance before each test
    beforeEach(() => {
      MockEventSource.lastInstance = null;
    });
  }
}

// @ts-ignore - Replace global EventSource with our mock
global.EventSource = MockEventSource;

// Extend Vitest's expect with React Testing Library's matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});
