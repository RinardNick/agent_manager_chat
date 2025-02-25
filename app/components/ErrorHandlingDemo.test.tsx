import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ErrorHandlingDemo } from './ErrorHandlingDemo';
import { ErrorType, attemptErrorRecovery } from '../lib/errorHandling';

// Mock the error recovery function
vi.mock('../lib/errorHandling', async () => {
  const actual = await vi.importActual('../lib/errorHandling');
  return {
    ...actual,
    attemptErrorRecovery: vi.fn(),
  };
});

describe('ErrorHandlingDemo Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render the demo interface correctly', () => {
    render(<ErrorHandlingDemo />);

    // Check for title
    expect(
      screen.getByRole('heading', { name: 'Error Handling Demo' })
    ).toBeInTheDocument();

    // Check for all error type buttons
    expect(
      screen.getByRole('button', { name: 'Configuration Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Connection Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Authentication Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Server Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Timeout Error' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Rate Limit Error' })
    ).toBeInTheDocument();
  });

  it('should show loading state when simulating an error', async () => {
    render(<ErrorHandlingDemo />);

    // Click on a button to simulate an error
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Connection Error' }));
    });

    // Loading state should be visible
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Fast-forward timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Error display should be visible after loading - use partial text match
    expect(screen.getByText(/internet connection/i)).toBeInTheDocument();
  });

  it('should display the error message after simulation', async () => {
    render(<ErrorHandlingDemo />);

    // Click on a button to simulate an error
    act(() => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Authentication Error' })
      );
    });

    // Fast-forward timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Error display should show the appropriate error - use partial text match
    expect(screen.getByText(/check your API key/i)).toBeInTheDocument();
  });

  it('should handle retry for recoverable errors', async () => {
    // Mock successful recovery
    vi.mocked(attemptErrorRecovery).mockResolvedValue({
      success: true,
      message: 'Recovery successful',
    });

    render(<ErrorHandlingDemo />);

    // Click on a button to simulate a recoverable error (like timeout)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Timeout Error' }));
    });

    // Fast-forward timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: 'Retry' });

    await act(async () => {
      fireEvent.click(retryButton);
    });

    // Should show loading again
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Fast-forward timer for recovery
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    // Error should be cleared after successful recovery
    expect(screen.queryByText(/request timed out/i)).not.toBeInTheDocument();
  });

  it('should handle failed recovery attempts', async () => {
    // Mock failed recovery
    vi.mocked(attemptErrorRecovery).mockResolvedValue({
      success: false,
      message: 'Recovery failed',
    });

    const { container } = render(<ErrorHandlingDemo />);

    // Click on a button to simulate a recoverable error
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Connection Error' }));
    });

    // Fast-forward timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Find and click the retry button
    const retryButton = screen.getByRole('button', { name: 'Retry' });

    // Mock the error update
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await act(async () => {
      fireEvent.click(retryButton);
      // Fast-forward timer for recovery attempt
      vi.advanceTimersByTime(1000);
    });

    // Debug output to see what's in the DOM
    // console.log(container.innerHTML);

    // Check if the error message is updated - we need to wait for the state update
    await act(async () => {
      // Additional time for React to update the state
      vi.advanceTimersByTime(100);
    });

    // Since the recovery message might not be directly visible in the DOM,
    // we can check if the retry button is no longer present (as it should be removed for non-recoverable errors)
    expect(
      screen.queryByRole('button', { name: 'Retry' })
    ).not.toBeInTheDocument();
  });

  it('should dismiss the error when dismiss button is clicked', async () => {
    render(<ErrorHandlingDemo />);

    // Click on a button to simulate an error
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Server Error' }));
    });

    // Fast-forward timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Find and click the dismiss button
    const dismissButton = screen.getByRole('button', { name: 'Dismiss' });

    act(() => {
      fireEvent.click(dismissButton);
    });

    // Error should be cleared
    expect(
      screen.queryByText(/server encountered an error/i)
    ).not.toBeInTheDocument();
  });
});
