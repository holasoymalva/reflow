/**
 * Tests for permission management
 */

import {
  checkRequiredPermissions,
  requestHTTPSPermissions,
  removeHTTPSPermissions,
  hasHTTPSPermissions,
  setupPermissionListener
} from './permissions';

// Mock Chrome API
const mockChrome = {
  permissions: {
    contains: jest.fn(),
    request: jest.fn(),
    remove: jest.fn(),
    onAdded: {
      addListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn()
    }
  }
};

(global as any).chrome = mockChrome;

describe('Permission Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRequiredPermissions', () => {
    it('should return true for both when all permissions are granted', async () => {
      mockChrome.permissions.contains.mockResolvedValue(true);

      const result = await checkRequiredPermissions();

      expect(result).toEqual({ hasBasic: true, hasHTTPS: true });
      expect(mockChrome.permissions.contains).toHaveBeenCalledTimes(2);
    });

    it('should return false for missing permissions', async () => {
      mockChrome.permissions.contains
        .mockResolvedValueOnce(true)  // Basic permissions
        .mockResolvedValueOnce(false); // HTTPS permissions

      const result = await checkRequiredPermissions();

      expect(result).toEqual({ hasBasic: true, hasHTTPS: false });
    });

    it('should handle errors gracefully', async () => {
      mockChrome.permissions.contains.mockRejectedValue(new Error('Permission check failed'));

      const result = await checkRequiredPermissions();

      expect(result).toEqual({ hasBasic: false, hasHTTPS: false });
    });
  });

  describe('requestHTTPSPermissions', () => {
    it('should return true when permissions are granted', async () => {
      mockChrome.permissions.request.mockResolvedValue(true);

      const result = await requestHTTPSPermissions();

      expect(result).toBe(true);
      expect(mockChrome.permissions.request).toHaveBeenCalledWith({
        permissions: ['webRequest', 'webRequestBlocking']
      });
    });

    it('should return false when permissions are denied', async () => {
      mockChrome.permissions.request.mockResolvedValue(false);

      const result = await requestHTTPSPermissions();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockChrome.permissions.request.mockRejectedValue(new Error('Request failed'));

      const result = await requestHTTPSPermissions();

      expect(result).toBe(false);
    });
  });

  describe('removeHTTPSPermissions', () => {
    it('should return true when permissions are removed', async () => {
      mockChrome.permissions.remove.mockResolvedValue(true);

      const result = await removeHTTPSPermissions();

      expect(result).toBe(true);
      expect(mockChrome.permissions.remove).toHaveBeenCalledWith({
        permissions: ['webRequest', 'webRequestBlocking']
      });
    });

    it('should return false when removal fails', async () => {
      mockChrome.permissions.remove.mockResolvedValue(false);

      const result = await removeHTTPSPermissions();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockChrome.permissions.remove.mockRejectedValue(new Error('Remove failed'));

      const result = await removeHTTPSPermissions();

      expect(result).toBe(false);
    });
  });

  describe('hasHTTPSPermissions', () => {
    it('should return true when HTTPS permissions are granted', async () => {
      mockChrome.permissions.contains.mockResolvedValue(true);

      const result = await hasHTTPSPermissions();

      expect(result).toBe(true);
    });

    it('should return false when HTTPS permissions are not granted', async () => {
      mockChrome.permissions.contains.mockResolvedValue(false);

      const result = await hasHTTPSPermissions();

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      mockChrome.permissions.contains.mockRejectedValue(new Error('Check failed'));

      const result = await hasHTTPSPermissions();

      expect(result).toBe(false);
    });
  });

  describe('setupPermissionListener', () => {
    it('should set up listeners for permission changes', () => {
      const callback = jest.fn();

      setupPermissionListener(callback);

      expect(mockChrome.permissions.onAdded.addListener).toHaveBeenCalledTimes(1);
      expect(mockChrome.permissions.onRemoved.addListener).toHaveBeenCalledTimes(1);
    });

    it('should call callback when permissions are added', async () => {
      const callback = jest.fn();
      let addedListener: any;

      mockChrome.permissions.onAdded.addListener.mockImplementation((listener) => {
        addedListener = listener;
      });

      mockChrome.permissions.contains.mockResolvedValue(true);

      setupPermissionListener(callback);

      // Simulate permission added
      await addedListener({ permissions: ['webRequest'] });

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should call callback when permissions are removed', async () => {
      const callback = jest.fn();
      let removedListener: any;

      mockChrome.permissions.onRemoved.addListener.mockImplementation((listener) => {
        removedListener = listener;
      });

      mockChrome.permissions.contains.mockResolvedValue(false);

      setupPermissionListener(callback);

      // Simulate permission removed
      await removedListener({ permissions: ['webRequest'] });

      expect(callback).toHaveBeenCalledWith(false);
    });
  });
});
