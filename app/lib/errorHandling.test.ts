import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapError,
  ErrorType,
  ErrorSeverity,
  attemptErrorRecovery,
  getUIErrorMessage,
  logError,
  AppError,
} from './errorHandling';
import { ConfigurationError } from '@rinardnick/client_mcp';

describe('Error Handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('mapError', () => {
    it('should handle null or undefined errors', () => {
      const nullError = mapError(null);
      const undefinedError = mapError(undefined);

      expect(nullError.type).toBe(ErrorType.UNKNOWN);
      expect(undefinedError.type).toBe(ErrorType.UNKNOWN);
    });

    it('should handle string errors', () => {
      const error = mapError('Test error message');

      expect(error.type).toBe(ErrorType.UNKNOWN);
      expect(error.message).toBe('Test error message');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(false);
    });

    it('should handle ConfigurationError', () => {
      const configError = new ConfigurationError('Invalid config');
      const error = mapError(configError);

      expect(error.type).toBe(ErrorType.CONFIGURATION);
      expect(error.message).toContain('Invalid config');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(true);
      expect(error.recoveryAction).toBeDefined();
    });

    it('should handle network errors', () => {
      const networkError = new Error('Failed to connect to network');
      const error = mapError(networkError);

      expect(error.type).toBe(ErrorType.CONNECTION);
      expect(error.message).toContain('Failed to connect to network');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.recoverable).toBe(true);
      expect(error.recoveryAction).toBeDefined();
    });

    it('should handle authentication errors', () => {
      const authError = new Error('Invalid API key or unauthorized access');
      const error = mapError(authError);

      expect(error.type).toBe(ErrorType.AUTHENTICATION);
      expect(error.message).toContain('Invalid API key');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(false);
    });

    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout after 30s');
      const error = mapError(timeoutError);

      expect(error.type).toBe(ErrorType.TIMEOUT);
      expect(error.message).toContain('Request timed out');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.recoverable).toBe(true);
      expect(error.recoveryAction).toBeDefined();
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = new Error('Rate limit exceeded, try again later');
      const error = mapError(rateLimitError);

      expect(error.type).toBe(ErrorType.RATE_LIMIT);
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.recoverable).toBe(true);
      expect(error.recoveryAction).toBeDefined();
    });

    it('should handle generic errors', () => {
      const genericError = new Error('Something went wrong');
      const error = mapError(genericError);

      expect(error.type).toBe(ErrorType.UNKNOWN);
      expect(error.message).toBe('Something went wrong');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(false);
    });

    it('should handle non-Error objects', () => {
      const nonError = { foo: 'bar' };
      const error = mapError(nonError);

      expect(error.type).toBe(ErrorType.UNKNOWN);
      expect(error.message).toBe('An unknown error occurred');
      expect(error.severity).toBe(ErrorSeverity.ERROR);
      expect(error.recoverable).toBe(false);
    });
  });

  describe('attemptErrorRecovery', () => {
    it('should return failure for non-recoverable errors', async () => {
      const error: AppError = {
        type: ErrorType.UNKNOWN,
        message: 'Test error',
        severity: ErrorSeverity.ERROR,
        recoverable: false,
      };

      const result = await attemptErrorRecovery(error);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error is not recoverable');
    });

    it('should return failure for recoverable errors without recovery action', async () => {
      const error: AppError = {
        type: ErrorType.UNKNOWN,
        message: 'Test error',
        severity: ErrorSeverity.ERROR,
        recoverable: true,
      };

      const result = await attemptErrorRecovery(error);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Error is not recoverable');
    });

    it('should return success for successful recovery', async () => {
      const error: AppError = {
        type: ErrorType.CONNECTION,
        message: 'Test error',
        severity: ErrorSeverity.WARNING,
        recoverable: true,
        recoveryAction: async () => {
          // Successful recovery
        },
      };

      const result = await attemptErrorRecovery(error);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Recovery successful');
    });

    it('should return failure when recovery action throws', async () => {
      const error: AppError = {
        type: ErrorType.CONNECTION,
        message: 'Test error',
        severity: ErrorSeverity.WARNING,
        recoverable: true,
        recoveryAction: async () => {
          throw new Error('Recovery failed');
        },
      };

      const result = await attemptErrorRecovery(error);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Recovery failed');
    });
  });

  describe('getUIErrorMessage', () => {
    it('should return user-friendly messages for each error type', () => {
      const errorTypes = Object.values(ErrorType);

      for (const type of errorTypes) {
        const error: AppError = {
          type: type as ErrorType,
          message: 'Original error message',
          severity: ErrorSeverity.ERROR,
          recoverable: false,
        };

        const message = getUIErrorMessage(error);
        expect(message).toBeTruthy();
        expect(typeof message).toBe('string');
        expect(message.length).toBeGreaterThan(10);
      }
    });
  });

  describe('logError', () => {
    it('should log errors with appropriate log level', () => {
      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {});
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const warningError: AppError = {
        type: ErrorType.CONNECTION,
        message: 'Connection error',
        severity: ErrorSeverity.WARNING,
        recoverable: true,
      };

      const criticalError: AppError = {
        type: ErrorType.AUTHENTICATION,
        message: 'Auth error',
        severity: ErrorSeverity.CRITICAL,
        recoverable: false,
      };

      logError(warningError);
      logError(criticalError);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[CONNECTION] Connection error',
        expect.any(Object)
      );

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AUTHENTICATION] Auth error',
        expect.any(Object)
      );
    });
  });
});
