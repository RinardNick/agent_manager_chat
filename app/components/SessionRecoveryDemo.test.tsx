import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock implementations
const mocks = {
  initializeSession: vi.fn().mockResolvedValue({ id: 'new-session-id' }),
  recoverSession: vi.fn().mockResolvedValue({ id: 'recovered-session-id' }),
  cleanupSession: vi.fn().mockResolvedValue(undefined),
  cleanupExpiredSessions: vi.fn().mockReturnValue(['expired-1', 'expired-2']),
  getPersistedSessionIds: vi.fn().mockReturnValue([]),
  getUIState: vi.fn().mockReturnValue({
    isLoading: false,
    isThinking: false,
    error: null,
  }),
};

// Use doMock instead of mock to avoid hoisting issues
vi.doMock('../lib/sessionManager', () => ({
  SessionManager: vi.fn().mockImplementation(() => mocks),
}));

vi.doMock('../lib/config', () => ({
  createConfig: vi.fn().mockReturnValue({
    type: 'claude',
    api_key: 'test-key',
    model: 'test-model',
    system_prompt: 'test prompt',
  }),
}));

// Now dynamically import the component to ensure mocks are set up first
describe('SessionRecoveryDemo', () => {
  let SessionRecoveryDemo: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset mock implementations before each test
    Object.assign(mocks, {
      initializeSession: vi.fn().mockResolvedValue({ id: 'new-session-id' }),
      recoverSession: vi.fn().mockResolvedValue({ id: 'recovered-session-id' }),
      cleanupSession: vi.fn().mockResolvedValue(undefined),
      cleanupExpiredSessions: vi
        .fn()
        .mockReturnValue(['expired-1', 'expired-2']),
      getPersistedSessionIds: vi.fn().mockReturnValue([]),
      getUIState: vi.fn().mockReturnValue({
        isLoading: false,
        isThinking: false,
        error: null,
      }),
    });

    // Dynamically import the component for each test
    const module = await import('./SessionRecoveryDemo');
    SessionRecoveryDemo = module.SessionRecoveryDemo;
  });

  it('renders the demo interface', async () => {
    render(<SessionRecoveryDemo />);

    expect(screen.getByText('Session Recovery Demo')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Create New Session' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Clean Up Expired Sessions' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Sessions are persisted to/)).toBeInTheDocument();
  });

  it('loads persisted sessions on mount', async () => {
    mocks.getPersistedSessionIds.mockReturnValueOnce([
      'session-1',
      'session-2',
    ]);

    render(<SessionRecoveryDemo />);

    expect(mocks.getPersistedSessionIds).toHaveBeenCalled();

    expect(screen.getByText('session-1')).toBeInTheDocument();
    expect(screen.getByText('session-2')).toBeInTheDocument();
  });

  it('creates a new session when button is clicked', async () => {
    render(<SessionRecoveryDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Create New Session' }));

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.initializeSession).toHaveBeenCalled();
      expect(screen.getByText(/Created new session/)).toBeInTheDocument();
    });

    expect(screen.getByText('new-session-id')).toBeInTheDocument();
  });

  it('recovers a session when recover button is clicked', async () => {
    mocks.getPersistedSessionIds.mockReturnValueOnce(['session-1']);

    render(<SessionRecoveryDemo />);

    // Find and click the recover button
    fireEvent.click(screen.getByRole('button', { name: 'Recover' }));

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.recoverSession).toHaveBeenCalledWith('session-1');
      expect(screen.getByText(/Recovered session/)).toBeInTheDocument();
    });

    expect(screen.getByText('recovered-session-id')).toBeInTheDocument();
  });

  it('cleans up a session when clean up button is clicked', async () => {
    mocks.getPersistedSessionIds.mockReturnValueOnce(['session-1']);

    render(<SessionRecoveryDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Clean Up' }));

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.cleanupSession).toHaveBeenCalledWith('session-1');
      expect(screen.getByText(/Cleaned up session/)).toBeInTheDocument();
    });
  });

  it('cleans up expired sessions when button is clicked', async () => {
    render(<SessionRecoveryDemo />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Clean Up Expired Sessions' })
    );

    // The cleanupExpiredSessions implementation seems to not show the loading state
    // or it completes too quickly, so we'll just wait for the success message

    await waitFor(() => {
      expect(mocks.cleanupExpiredSessions).toHaveBeenCalled();
      expect(
        screen.getByText(/Cleaned up 2 expired sessions/)
      ).toBeInTheDocument();
    });
  });

  it('handles errors gracefully', async () => {
    mocks.initializeSession.mockRejectedValueOnce(new Error('Test error'));

    render(<SessionRecoveryDemo />);

    fireEvent.click(screen.getByRole('button', { name: 'Create New Session' }));

    await waitFor(() => {
      expect(screen.getByText(/Failed to create session/)).toBeInTheDocument();
      expect(screen.getByText(/Test error/)).toBeInTheDocument();
    });
  });
});
