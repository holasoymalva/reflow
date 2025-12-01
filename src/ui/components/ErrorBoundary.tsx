import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandler } from '../utils/errorHandler';
import { ErrorCode, ExtensionError } from '@/types';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch React errors and display fallback UI
 * Logs errors to background script and shows user-friendly messages
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Create ExtensionError for better handling
    const extensionError = new ExtensionError(
      error.message,
      ErrorCode.UNKNOWN_ERROR,
      true,
      'An unexpected error occurred in the application. Please refresh and try again.'
    );

    // Log to error handler
    errorHandler.logError(extensionError);

    // Send to background script
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'logError',
        payload: {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        }
      }).catch(() => {
        // Silently fail if background script is not available
      });
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            margin: '16px'
          }}
        >
          <h2 style={{ color: '#dc2626', marginBottom: '12px' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#991b1b', marginBottom: '16px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
