import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Chat } from './Chat';
import React from 'react';

describe('Chat Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment variables
    vi.stubEnv('NEXT_PUBLIC_ANTHROPIC_API_KEY', 'test-api-key');
    vi.stubEnv('NEXT_PUBLIC_LLM_TYPE', 'claude');
    vi.stubEnv('NEXT_PUBLIC_LLM_MODEL', 'claude-3-sonnet-20240229');
    vi.stubEnv('NEXT_PUBLIC_SYSTEM_PROMPT', 'You are a helpful assistant.');

    // Setup fetch mock for session initialization
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          sessionId: 'test-session-id',
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'assistant', content: 'I am ready to help.' },
          ],
        }),
    });
  });

  it('should show initial assistant message on load', async () => {
    render(<Chat />);

    // User should see the initial greeting
    await waitFor(() => {
      expect(screen.getByText('I am ready to help.')).toBeInTheDocument();
    });
  });

  it('should allow user to send a message and see the response', async () => {
    render(<Chat />);

    // Wait for chat to initialize
    await waitFor(() => {
      expect(screen.getByText('I am ready to help.')).toBeInTheDocument();
    });

    // User types and sends a message
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);
    });

    // User's message should appear in the chat
    expect(screen.getByText('Hello')).toBeInTheDocument();

    // Send button should be disabled while waiting for response
    expect(sendButton).toBeDisabled();

    // Input should be cleared after sending
    expect(input).toHaveValue('');

    // Simulate the assistant's response
    await act(async () => {
      (global.EventSource as any).simulateResponse('Test response');
    });

    // User should see the assistant's response
    await waitFor(() => {
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });

    // Add a new message to enable the send button
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Next message' } });
    });

    // Send button should be enabled again after response
    await waitFor(() => {
      expect(sendButton).toBeEnabled();
      expect(input).toBeEnabled();
    });
  });

  it('should handle connection errors with clear user feedback', async () => {
    render(<Chat />);

    // Wait for chat to initialize
    await waitFor(() => {
      expect(screen.getByText('I am ready to help.')).toBeInTheDocument();
    });

    // User sends a message
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);
    });

    // Simulate a connection error
    await act(async () => {
      (global.EventSource as any).simulateConnectionError();
    });

    // User should see an error message
    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveTextContent(/failed|error|unable/i);
    });

    // Add a new message to enable the send button
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Next message' } });
    });

    // User should be able to try again
    await waitFor(() => {
      expect(sendButton).toBeEnabled();
      expect(input).toBeEnabled();
    });
  });

  it('should handle server errors with clear user feedback', async () => {
    render(<Chat />);

    // Wait for chat to initialize
    await waitFor(() => {
      expect(screen.getByText('I am ready to help.')).toBeInTheDocument();
    });

    // User sends a message
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);
    });

    // Simulate a server error
    await act(async () => {
      (global.EventSource as any).simulateServerError('Server error occurred');
    });

    // User should see an error message
    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveTextContent(/error/i);
    });

    // Add a new message to enable the send button
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Next message' } });
    });

    // User should be able to try again
    await waitFor(() => {
      expect(sendButton).toBeEnabled();
      expect(input).toBeEnabled();
    });
  });

  it('should show loading state while waiting for response', async () => {
    render(<Chat />);

    // Wait for chat to initialize
    await waitFor(() => {
      expect(screen.getByText('I am ready to help.')).toBeInTheDocument();
    });

    // User sends a message
    const input = screen.getByPlaceholderText('Type your message...');
    const sendButton = screen.getByText('Send');

    await act(async () => {
      fireEvent.change(input, { target: { value: 'Hello' } });
      fireEvent.click(sendButton);
    });

    // Send button should show loading state
    expect(screen.getByText('Sending...')).toBeInTheDocument();
    expect(sendButton).toBeDisabled();
    expect(input).toBeDisabled();

    // Simulate response
    await act(async () => {
      (global.EventSource as any).simulateResponse('Response received');
    });

    // Add a new message to enable the send button
    await act(async () => {
      fireEvent.change(input, { target: { value: 'Next message' } });
    });

    // Loading state should clear
    await waitFor(() => {
      expect(screen.getByText('Send')).toBeEnabled();
      expect(input).toBeEnabled();
    });
  });
});
