import { ErrorHandler } from './errorHandler';
import { ErrorCode, ExtensionError } from '@/types';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    handler = ErrorHandler.getInstance();
  });

  describe('createExtensionError', () => {
    it('should create an ExtensionError from a generic error', () => {
      const error = new Error('Test error');
      const extensionError = handler.createExtensionError(
        error,
        ErrorCode.VALIDATION_ERROR,
        'Custom user message'
      );

      expect(extensionError).toBeInstanceOf(ExtensionError);
      expect(extensionError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(extensionError.userMessage).toBe('Custom user message');
      expect(extensionError.recoverable).toBe(true);
    });

    it('should use default user message if not provided', () => {
      const error = new Error('Storage quota exceeded');
      const extensionError = handler.createExtensionError(error);

      expect(extensionError.userMessage).toContain('Storage');
    });
  });

  describe('handleStorageError', () => {
    it('should create storage error for quota exceeded', () => {
      const error = new Error('QUOTA_BYTES exceeded');
      const extensionError = handler.handleStorageError(error);

      expect(extensionError.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(extensionError.userMessage).toContain('Storage limit reached');
      expect(extensionError.recoverable).toBe(true);
    });

    it('should create generic storage error for other storage issues', () => {
      const error = new Error('Storage write failed');
      const extensionError = handler.handleStorageError(error);

      expect(extensionError.code).toBe(ErrorCode.STORAGE_ERROR);
      expect(extensionError.userMessage).toContain('Failed to save data');
    });
  });

  describe('handleValidationError', () => {
    it('should create validation error with field and reason', () => {
      const extensionError = handler.handleValidationError('URL pattern', 'invalid regex');

      expect(extensionError.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(extensionError.userMessage).toContain('URL pattern');
      expect(extensionError.userMessage).toContain('invalid regex');
      expect(extensionError.recoverable).toBe(true);
    });
  });

  describe('handleNetworkError', () => {
    it('should create network error', () => {
      const error = new Error('Failed to fetch');
      const extensionError = handler.handleNetworkError(error);

      expect(extensionError.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(extensionError.userMessage).toContain('Network request failed');
      expect(extensionError.recoverable).toBe(true);
    });
  });

  describe('handleImportError', () => {
    it('should create import error', () => {
      const error = new Error('Invalid JSON');
      const extensionError = handler.handleImportError(error);

      expect(extensionError.code).toBe(ErrorCode.IMPORT_ERROR);
      expect(extensionError.userMessage).toContain('Failed to import rules');
      expect(extensionError.recoverable).toBe(true);
    });
  });

  describe('handlePermissionError', () => {
    it('should create permission error', () => {
      const extensionError = handler.handlePermissionError('webRequest');

      expect(extensionError.code).toBe(ErrorCode.PERMISSION_ERROR);
      expect(extensionError.userMessage).toContain('webRequest');
      expect(extensionError.recoverable).toBe(false);
    });
  });

  describe('showToast', () => {
    it('should notify listeners when toast is shown', () => {
      const listener = jest.fn();
      const unsubscribe = handler.onToast(listener);

      handler.showToast('Test message', 'info');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Test message',
          type: 'info',
          duration: 5000
        })
      );

      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = handler.onToast(listener);
      unsubscribe();

      handler.showToast('Test message', 'info');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error to console', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Test error');

      handler.logError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Chrome Request Manager Error]',
        expect.objectContaining({
          message: 'Test error'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log ExtensionError with additional fields', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new ExtensionError(
        'Test error',
        ErrorCode.VALIDATION_ERROR,
        true,
        'User message'
      );

      handler.logError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Chrome Request Manager Error]',
        expect.objectContaining({
          message: 'Test error',
          code: ErrorCode.VALIDATION_ERROR,
          recoverable: true,
          userMessage: 'User message'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});
