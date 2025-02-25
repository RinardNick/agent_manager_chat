'use client';

import React, { useState } from 'react';
import { ErrorDisplay } from './ui/ErrorDisplay';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
  AppError,
  ErrorSeverity,
  ErrorType,
  attemptErrorRecovery,
  mapError,
} from '../lib/errorHandling';

export function ErrorHandlingDemo() {
  const [currentError, setCurrentError] = useState<AppError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Function to simulate different types of errors
  const simulateError = (errorType: ErrorType) => {
    setIsLoading(true);

    // Simulate API call with a delay
    setTimeout(() => {
      let error: Error;

      switch (errorType) {
        case ErrorType.CONFIGURATION:
          error = new Error('Invalid configuration: API key is missing');
          break;
        case ErrorType.CONNECTION:
          error = new Error('Failed to connect to network');
          break;
        case ErrorType.AUTHENTICATION:
          error = new Error('Invalid API key or unauthorized access');
          break;
        case ErrorType.SERVER:
          error = new Error('Internal server error: 500');
          break;
        case ErrorType.TIMEOUT:
          error = new Error('Request timeout after 30s');
          break;
        case ErrorType.RATE_LIMIT:
          error = new Error('Rate limit exceeded, try again later');
          break;
        default:
          error = new Error('An unknown error occurred');
      }

      // Map the error to our AppError format
      const mappedError = mapError(error);
      setCurrentError(mappedError);
      setIsLoading(false);
    }, 1000);
  };

  // Handle retry action
  const handleRetry = async () => {
    if (!currentError) return;

    setIsLoading(true);

    // Attempt to recover from the error
    const recovery = await attemptErrorRecovery(currentError);

    if (recovery.success) {
      // If recovery was successful, clear the error
      setCurrentError(null);
      // Simulate successful operation after recovery
      setTimeout(() => {
        setIsLoading(false);
      }, 1500);
    } else {
      // If recovery failed, update the error message
      setCurrentError({
        ...currentError,
        message: `Recovery failed: ${recovery.message}`,
        recoverable: false,
      });
      setIsLoading(false);
    }
  };

  // Handle dismiss action
  const handleDismiss = () => {
    setCurrentError(null);
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">Error Handling Demo</h2>
      <p className="text-gray-600">
        Click the buttons below to simulate different types of errors and see
        how they are handled.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Button
          onClick={() => simulateError(ErrorType.CONFIGURATION)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Configuration Error
        </Button>

        <Button
          onClick={() => simulateError(ErrorType.CONNECTION)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Connection Error
        </Button>

        <Button
          onClick={() => simulateError(ErrorType.AUTHENTICATION)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Authentication Error
        </Button>

        <Button
          onClick={() => simulateError(ErrorType.SERVER)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Server Error
        </Button>

        <Button
          onClick={() => simulateError(ErrorType.TIMEOUT)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Timeout Error
        </Button>

        <Button
          onClick={() => simulateError(ErrorType.RATE_LIMIT)}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Rate Limit Error
        </Button>
      </div>

      {isLoading && (
        <Card className="p-4 border border-gray-200">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Loading...</span>
          </div>
        </Card>
      )}

      {currentError && !isLoading && (
        <ErrorDisplay
          error={currentError}
          onRetry={currentError.recoverable ? handleRetry : undefined}
          onDismiss={handleDismiss}
          className="mt-6"
        />
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium mb-2">Implementation Notes:</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          <li>
            Errors are mapped to a consistent <code>AppError</code> format using
            the <code>mapError</code> function.
          </li>
          <li>
            The <code>ErrorDisplay</code> component adapts its appearance based
            on error severity.
          </li>
          <li>
            Recoverable errors show a "Retry" button that attempts automatic
            recovery.
          </li>
          <li>Error messages are user-friendly and provide clear guidance.</li>
        </ul>
      </div>
    </div>
  );
}
