import { vi } from 'vitest';

const mockProcess = {
  kill: vi.fn(),
  on: vi.fn(),
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
};

// Setup default event handlers to prevent errors
mockProcess.on.mockImplementation((event: string, handler: Function) => {
  if (event === 'error') {
    // Don't call error handler by default
  }
  return mockProcess;
});

export const spawn = vi.fn(() => mockProcess);
export const ChildProcess = vi.fn();

// Export the mock process for test configuration
export const __mockProcess = mockProcess;
