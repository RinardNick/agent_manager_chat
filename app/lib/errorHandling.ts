import { ConfigurationError } from '@rinardnick/client_mcp';

// Define error types
export enum ErrorType {
  CONFIGURATION = 'configuration',
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  SERVER = 'server',
  CLIENT = 'client',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown',
}

// Define error severity levels
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Define application error interface
export interface AppError {
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  originalError?: Error;
  recoverable: boolean;
  recoveryAction?: () => Promise<void>;
}

// Map error to AppError
export function mapError(error: unknown): AppError {
  // Default error
  const defaultError: AppError = {
    type: ErrorType.UNKNOWN,
    message: 'An unknown error occurred',
    severity: ErrorSeverity.ERROR,
    recoverable: false,
  };

  if (!error) {
    return defaultError;
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      ...defaultError,
      message: error,
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Configuration errors
    if (error instanceof ConfigurationError) {
      return {
        type: ErrorType.CONFIGURATION,
        message: `Configuration error: ${error.message}`,
        severity: ErrorSeverity.ERROR,
        originalError: error,
        recoverable: true,
        recoveryAction: async () => {
          // Could reload config from defaults
          console.log('Attempting to recover from configuration error');
        },
      };
    }

    // Network errors
    if (error.name === 'NetworkError' || error.message.includes('network')) {
      return {
        type: ErrorType.CONNECTION,
        message: `Connection error: ${error.message}`,
        severity: ErrorSeverity.WARNING,
        originalError: error,
        recoverable: true,
        recoveryAction: async () => {
          // Could retry connection
          console.log('Attempting to recover from network error');
        },
      };
    }

    // Authentication errors
    if (
      error.message.includes('authentication') ||
      error.message.includes('unauthorized') ||
      error.message.includes('forbidden') ||
      error.message.includes('api key')
    ) {
      return {
        type: ErrorType.AUTHENTICATION,
        message: `Authentication error: ${error.message}`,
        severity: ErrorSeverity.ERROR,
        originalError: error,
        recoverable: false,
      };
    }

    // Timeout errors
    if (error.message.includes('timeout')) {
      return {
        type: ErrorType.TIMEOUT,
        message: `Request timed out: ${error.message}`,
        severity: ErrorSeverity.WARNING,
        originalError: error,
        recoverable: true,
        recoveryAction: async () => {
          // Could retry with longer timeout
          console.log('Attempting to recover from timeout');
        },
      };
    }

    // Rate limit errors
    if (
      error.message.toLowerCase().includes('rate limit') ||
      error.message.toLowerCase().includes('too many requests') ||
      error.message.toLowerCase().includes('ratelimit')
    ) {
      return {
        type: ErrorType.RATE_LIMIT,
        message: `Rate limit exceeded: ${error.message}`,
        severity: ErrorSeverity.WARNING,
        originalError: error,
        recoverable: true,
        recoveryAction: async () => {
          // Could wait and retry
          console.log('Attempting to recover from rate limit');
          await new Promise(resolve => setTimeout(resolve, 5000));
        },
      };
    }

    // Default Error handling
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || 'An error occurred',
      severity: ErrorSeverity.ERROR,
      originalError: error,
      recoverable: false,
    };
  }

  // Handle unknown error types
  return defaultError;
}

// Error recovery helper
export async function attemptErrorRecovery(
  error: AppError
): Promise<{ success: boolean; message: string }> {
  if (!error.recoverable || !error.recoveryAction) {
    return {
      success: false,
      message: 'Error is not recoverable',
    };
  }

  try {
    await error.recoveryAction();
    return {
      success: true,
      message: 'Recovery successful',
    };
  } catch (recoveryError) {
    return {
      success: false,
      message: `Recovery failed: ${
        recoveryError instanceof Error ? recoveryError.message : 'Unknown error'
      }`,
    };
  }
}

// UI friendly error messages
export function getUIErrorMessage(error: AppError): string {
  switch (error.type) {
    case ErrorType.CONFIGURATION:
      return 'There was a problem with the application configuration. Please check your settings.';
    case ErrorType.CONNECTION:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case ErrorType.AUTHENTICATION:
      return 'Authentication failed. Please check your API key and try again.';
    case ErrorType.SERVER:
      return 'The server encountered an error. Please try again later.';
    case ErrorType.CLIENT:
      return 'There was a problem with the application. Please refresh the page and try again.';
    case ErrorType.TIMEOUT:
      return 'The request timed out. Please try again.';
    case ErrorType.RATE_LIMIT:
      return 'You have made too many requests. Please wait a moment and try again.';
    case ErrorType.UNKNOWN:
    default:
      return 'An unexpected error occurred. Please try again later.';
  }
}

// Error logging
export function logError(error: AppError): void {
  const logLevel = error.severity === ErrorSeverity.CRITICAL ? 'error' : 'warn';
  console[logLevel](`[${error.type.toUpperCase()}] ${error.message}`, {
    error: error.originalError,
    recoverable: error.recoverable,
  });
}
