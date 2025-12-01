import { ExtensionError, ErrorCode } from '@/types';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'success' | 'info';
  duration?: number;
}

type ToastListener = (notification: ToastNotification) => void;

/**
 * ErrorHandler utility for managing errors and user notifications
 * Handles error logging, user-friendly messages, and toast notifications
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private toastListeners: Set<ToastListener> = new Set();
  private notificationId = 0;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle an error - log it and notify the user
   */
  handleError(error: Error | ExtensionError): void {
    this.logError(error);
    this.notifyUser(error);
  }

  /**
   * Log error to console and optionally to background script
   */
  logError(error: Error | ExtensionError): void {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      message: error.message,
      stack: error.stack,
      ...(error instanceof ExtensionError && {
        code: error.code,
        recoverable: error.recoverable,
        userMessage: error.userMessage
      })
    };

    console.error('[Chrome Request Manager Error]', errorInfo);

    // Send to background script for persistent logging
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'logError',
        payload: errorInfo
      }).catch(() => {
        // Silently fail if background script is not available
      });
    }
  }

  /**
   * Show user-friendly notification
   */
  notifyUser(error: Error | ExtensionError): void {
    let message: string;
    let type: ToastNotification['type'] = 'error';

    if (error instanceof ExtensionError) {
      message = error.userMessage;
      type = error.recoverable ? 'warning' : 'error';
    } else {
      message = this.getGenericErrorMessage(error);
    }

    this.showToast(message, type);
  }

  /**
   * Show a toast notification
   */
  showToast(
    message: string,
    type: ToastNotification['type'] = 'info',
    duration: number = 5000
  ): void {
    const notification: ToastNotification = {
      id: `toast-${++this.notificationId}`,
      message,
      type,
      duration
    };

    this.toastListeners.forEach(listener => listener(notification));
  }

  /**
   * Subscribe to toast notifications
   */
  onToast(listener: ToastListener): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  /**
   * Create an ExtensionError from a generic error
   */
  createExtensionError(
    error: unknown,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    userMessage?: string
  ): ExtensionError {
    const message = error instanceof Error ? error.message : String(error);
    const finalUserMessage = userMessage || this.getGenericErrorMessage(error);
    const recoverable = this.isRecoverableError(code);

    return new ExtensionError(message, code, recoverable, finalUserMessage);
  }

  /**
   * Get user-friendly error message based on error type
   */
  private getGenericErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('quota') || message.includes('storage')) {
        return 'Storage limit reached. Please clear old logs or rules.';
      }
      if (message.includes('permission')) {
        return 'Permission denied. Please check extension permissions.';
      }
      if (message.includes('network') || message.includes('fetch')) {
        return 'Network error. Please check your connection.';
      }
      if (message.includes('invalid') || message.includes('validation')) {
        return 'Invalid input. Please check your data and try again.';
      }
    }

    return 'An unexpected error occurred. Please try again.';
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverableError(code: ErrorCode): boolean {
    return code !== ErrorCode.PERMISSION_ERROR && code !== ErrorCode.UNKNOWN_ERROR;
  }

  /**
   * Handle storage errors specifically
   */
  handleStorageError(error: unknown): ExtensionError {
    const message = error instanceof Error ? error.message : String(error);
    const isQuotaError = message.toLowerCase().includes('quota');

    return new ExtensionError(
      message,
      ErrorCode.STORAGE_ERROR,
      true,
      isQuotaError
        ? 'Storage limit reached. Please clear old logs or rules to free up space.'
        : 'Failed to save data. Please try again.'
    );
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, reason: string): ExtensionError {
    return new ExtensionError(
      `Validation failed for ${field}: ${reason}`,
      ErrorCode.VALIDATION_ERROR,
      true,
      `Invalid ${field}: ${reason}`
    );
  }

  /**
   * Handle network errors
   */
  handleNetworkError(error: unknown): ExtensionError {
    const message = error instanceof Error ? error.message : String(error);

    return new ExtensionError(
      message,
      ErrorCode.NETWORK_ERROR,
      true,
      'Network request failed. Please check your connection and try again.'
    );
  }

  /**
   * Handle import errors
   */
  handleImportError(error: unknown): ExtensionError {
    const message = error instanceof Error ? error.message : String(error);

    return new ExtensionError(
      message,
      ErrorCode.IMPORT_ERROR,
      true,
      'Failed to import rules. Please check the file format and try again.'
    );
  }

  /**
   * Handle permission errors
   */
  handlePermissionError(permission: string): ExtensionError {
    return new ExtensionError(
      `Missing permission: ${permission}`,
      ErrorCode.PERMISSION_ERROR,
      false,
      `This feature requires the "${permission}" permission. Please enable it in extension settings.`
    );
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
