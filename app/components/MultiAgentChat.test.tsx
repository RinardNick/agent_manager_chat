import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import MultiAgentChat from './MultiAgentChat';
import React from 'react';

// Define helper to wait for a condition
const waitForCondition = (condition: () => boolean, timeout = 1000) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (condition()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error('Condition not met within timeout'));
      }
    }, 50);
  });
};

describe('MultiAgentChat Component', () => {
  // Mock global.EventSource
// First create a class for mocking
class MockEventSource {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onopen: ((event: any) => void) | null = null;
  listeners: Record<string, ((event: any) => void)[]> = {};
  url: string;
  readyState: number = 0; // CONNECTING
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url: string) {
    this.url = url;
    // Simulate connection
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.dispatchEvent({ type: 'open' });
    }, 50);
  }

  addEventListener(type: string, callback: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(callback);
  }

  removeEventListener(type: string, callback: (event: any) => void) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }
  }

  dispatchEvent(event: any) {
    if (event.type === 'message' && this.onmessage) {
      this.onmessage(event);
    } else if (event.type === 'error' && this.onerror) {
      this.onerror(event);
    } else if (event.type === 'open' && this.onopen) {
      this.onopen(event);
    }

    // Also dispatch to event listeners
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(callback => callback(event));
    }
    return true;
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Helper method for testing
  emit(data: any) {
    this.dispatchEvent({
      type: 'message',
      data: JSON.stringify(data),
    });
  }
}

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up global EventSource mock
    global.EventSource = MockEventSource as any;

    // Setup fetch mock for session initialization
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.toString().includes('/api/chat/session') && (global.fetch as any).mockImplementation.mock.calls[0][1]?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            sessionId: 'test-session-id',
            messages: [],
          }),
        });
      } else if (url.toString().includes('/api/agent') && (global.fetch as any).mockImplementation.mock.calls[0][1]?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            parentSessionId: 'parent-session-id',
            childSessionId: 'child-session-id',
          }),
        });
      } else if (url.toString().includes('/api/agent') && (global.fetch as any).mockImplementation.mock.calls[0][1]?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  it('should pass a simple test to verify setup', () => {
    expect(true).toBe(true);
  });
});