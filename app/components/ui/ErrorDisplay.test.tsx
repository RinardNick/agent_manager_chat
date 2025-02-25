import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorDisplay } from './ErrorDisplay';
import { AppError, ErrorSeverity, ErrorType } from '../../lib/errorHandling';

describe('ErrorDisplay Component', () => {
  it('should render error message correctly', () => {
    const error: AppError = {
      type: ErrorType.CONNECTION,
      message: 'Failed to connect to server',
      severity: ErrorSeverity.ERROR,
      recoverable: false,
    };

    render(<ErrorDisplay error={error} />);

    // Check for title
    expect(screen.getByText('Connection Error')).toBeInTheDocument();

    // Check for user-friendly message
    expect(
      screen.getByText(/Unable to connect to the server/i)
    ).toBeInTheDocument();
  });

  it('should show retry button for recoverable errors', () => {
    const error: AppError = {
      type: ErrorType.TIMEOUT,
      message: 'Request timed out',
      severity: ErrorSeverity.WARNING,
      recoverable: true,
    };

    const onRetry = vi.fn();
    render(<ErrorDisplay error={error} onRetry={onRetry} />);

    // Check for retry button
    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();

    // Check for recoverable message
    expect(
      screen.getByText(/This error can be automatically resolved/i)
    ).toBeInTheDocument();

    // Test retry callback
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button for non-recoverable errors', () => {
    const error: AppError = {
      type: ErrorType.AUTHENTICATION,
      message: 'Invalid API key',
      severity: ErrorSeverity.ERROR,
      recoverable: false,
    };

    const onRetry = vi.fn();
    render(<ErrorDisplay error={error} onRetry={onRetry} />);

    // Retry button should not be present
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const error: AppError = {
      type: ErrorType.UNKNOWN,
      message: 'Unknown error',
      severity: ErrorSeverity.INFO,
      recoverable: false,
    };

    const onDismiss = vi.fn();
    render(<ErrorDisplay error={error} onDismiss={onDismiss} />);

    // Check for dismiss button
    const dismissButton = screen.getByText('Dismiss');
    expect(dismissButton).toBeInTheDocument();

    // Test dismiss callback
    fireEvent.click(dismissButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should apply different styles based on severity', () => {
    const criticalError: AppError = {
      type: ErrorType.SERVER,
      message: 'Critical server error',
      severity: ErrorSeverity.CRITICAL,
      recoverable: false,
    };

    const { rerender } = render(<ErrorDisplay error={criticalError} />);

    // Critical error should have red styling
    const card = screen
      .getByRole('heading', { name: 'Server Error' })
      .closest('.border');
    expect(card).toHaveClass('bg-red-50');

    // Warning error should have amber styling
    const warningError: AppError = {
      type: ErrorType.TIMEOUT,
      message: 'Request timed out',
      severity: ErrorSeverity.WARNING,
      recoverable: true,
    };

    rerender(<ErrorDisplay error={warningError} />);
    const warningCard = screen
      .getByRole('heading', { name: 'Timeout Error' })
      .closest('.border');
    expect(warningCard).toHaveClass('bg-amber-50');
  });
});
