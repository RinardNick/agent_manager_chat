'use client';

import React from 'react';
import {
  AppError,
  ErrorSeverity,
  ErrorType,
  getUIErrorMessage,
} from '../../lib/errorHandling';
import { Button } from './button';
import { Card } from './card';
import { cn } from '../../lib/utils';

interface ErrorDisplayProps {
  error: AppError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  className,
}: ErrorDisplayProps) {
  const message = getUIErrorMessage(error);

  // Determine icon and color based on severity and type
  const getSeverityStyles = () => {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        return 'bg-red-50 text-red-700 border-red-200';
      case ErrorSeverity.ERROR:
        return 'bg-red-50 text-red-700 border-red-200';
      case ErrorSeverity.WARNING:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case ErrorSeverity.INFO:
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const getIcon = () => {
    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-red-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        );
      case ErrorSeverity.WARNING:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-amber-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case ErrorSeverity.INFO:
      default:
        return (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-blue-500"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
    }
  };

  const getErrorTitle = () => {
    switch (error.type) {
      case ErrorType.CONFIGURATION:
        return 'Configuration Error';
      case ErrorType.CONNECTION:
        return 'Connection Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Error';
      case ErrorType.SERVER:
        return 'Server Error';
      case ErrorType.CLIENT:
        return 'Application Error';
      case ErrorType.TIMEOUT:
        return 'Timeout Error';
      case ErrorType.RATE_LIMIT:
        return 'Rate Limit Exceeded';
      case ErrorType.UNKNOWN:
      default:
        return 'Error';
    }
  };

  return (
    <Card className={cn('border p-4', getSeverityStyles(), className)}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="flex-1">
          <h3 className="font-medium">{getErrorTitle()}</h3>
          <p className="mt-1 text-sm">{message}</p>
          {error.recoverable && (
            <p className="mt-1 text-sm opacity-80">
              This error can be automatically resolved.
            </p>
          )}
          <div className="mt-3 flex space-x-2">
            {error.recoverable && onRetry && (
              <Button
                onClick={onRetry}
                className="bg-primary hover:bg-primary/90"
              >
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button
                onClick={onDismiss}
                className="bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
