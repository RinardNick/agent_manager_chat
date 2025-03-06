import { vi } from 'vitest';

// Async generator function for stream response
const mockSendMessageStream = async function* () {
  yield { type: 'thinking', content: 'Thinking...' };
  yield { type: 'content', content: 'Hello, this is a test response!' };
  yield {
    type: 'tool_start',
    tool: {
      name: 'testTool',
      parameters: { param1: 'value1' },
    },
  };
  yield {
    type: 'tool_result',
    tool: {
      name: 'testTool',
    },
    result: 'Test result',
  };
  yield { type: 'done' };
};

export const getMCPSessionManager = vi.fn().mockResolvedValue({
  sendMessageStream: vi.fn().mockImplementation(() => mockSendMessageStream()),
});

export const getActiveSessionId = vi.fn().mockReturnValue('default-session-id');

export const getAllSessions = vi.fn().mockReturnValue([
  {
    id: 'default-session-id',
    name: 'Default Session',
    createdAt: 1616161616161,
    lastUsedAt: 1616161616161,
  },
]);

export const getActiveSession = vi.fn().mockReturnValue({
  id: 'default-session-id',
  name: 'Default Session',
  createdAt: 1616161616161,
  lastUsedAt: 1616161616161,
});

export const setActiveSession = vi.fn().mockReturnValue(true);
export const deleteSession = vi.fn().mockReturnValue(true);
export const renameSession = vi.fn().mockReturnValue(true);
export const clearAllSessions = vi.fn();
export const initializeNewSession = vi.fn().mockResolvedValue({
  id: 'new-session-id',
  name: 'New Session',
  createdAt: 1616161616161,
  lastUsedAt: 1616161616161,
});
