import { UIController } from './UIController';
import { Rule, LogEntry, ExportData } from '@/types';

// Mock chrome.runtime
const mockSendMessage = jest.fn();

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: null as any,
  },
} as any;

describe('UIController', () => {
  let controller: UIController;

  beforeEach(() => {
    controller = new UIController();
    mockSendMessage.mockClear();
    (global.chrome.runtime as any).lastError = null;
  });

  describe('getRules', () => {
    it('should fetch rules successfully', async () => {
      const mockRules: Rule[] = [
        {
          id: '1',
          name: 'Test Rule',
          enabled: true,
          priority: 1,
          urlPattern: '.*',
          action: { type: 'modifyHeaders', requestHeaders: [] },
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      ];

      mockSendMessage.mockResolvedValue({
        success: true,
        data: mockRules,
      });

      const result = await controller.getRules();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'getRules' });
      expect(result).toEqual(mockRules);
    });

    it('should throw error on failure', async () => {
      mockSendMessage.mockResolvedValue({
        success: false,
        error: 'Failed to fetch rules',
      });

      await expect(controller.getRules()).rejects.toThrow('Failed to fetch rules');
    });
  });

  describe('createRule', () => {
    it('should create a rule successfully', async () => {
      const newRule = {
        name: 'New Rule',
        enabled: true,
        priority: 1,
        urlPattern: '.*',
        action: { type: 'modifyHeaders' as const, requestHeaders: [] },
      };

      const createdRule: Rule = {
        ...newRule,
        id: '123',
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      mockSendMessage.mockResolvedValue({
        success: true,
        data: createdRule,
      });

      const result = await controller.createRule(newRule);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'createRule',
        payload: newRule,
      });
      expect(result).toEqual(createdRule);
    });
  });

  describe('updateRule', () => {
    it('should update a rule successfully', async () => {
      const updates = { enabled: false };
      const updatedRule: Rule = {
        id: '1',
        name: 'Test Rule',
        enabled: false,
        priority: 1,
        urlPattern: '.*',
        action: { type: 'modifyHeaders', requestHeaders: [] },
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      mockSendMessage.mockResolvedValue({
        success: true,
        data: updatedRule,
      });

      const result = await controller.updateRule('1', updates);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'updateRule',
        payload: { id: '1', updates },
      });
      expect(result).toEqual(updatedRule);
    });
  });

  describe('deleteRule', () => {
    it('should delete a rule successfully', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: undefined,
      });

      await controller.deleteRule('1');

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'deleteRule',
        payload: { id: '1' },
      });
    });
  });

  describe('toggleRule', () => {
    it('should toggle a rule successfully', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: undefined,
      });

      await controller.toggleRule('1', false);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'toggleRule',
        payload: { id: '1', enabled: false },
      });
    });
  });

  describe('toggleGlobalPause', () => {
    it('should toggle global pause successfully', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: undefined,
      });

      await controller.toggleGlobalPause(true);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'toggleGlobalPause',
        payload: { paused: true },
      });
    });
  });

  describe('getLogs', () => {
    it('should fetch logs successfully', async () => {
      const mockLogs: LogEntry[] = [
        {
          id: '1',
          timestamp: new Date(),
          url: 'https://example.com',
          method: 'GET',
          statusCode: 200,
          requestHeaders: {},
          responseHeaders: {},
          appliedRules: [],
          modifications: [],
        },
      ];

      mockSendMessage.mockResolvedValue({
        success: true,
        data: mockLogs,
      });

      const result = await controller.getLogs();

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'getLogs',
        payload: { filter: undefined },
      });
      expect(result).toEqual(mockLogs);
    });

    it('should fetch logs with filter', async () => {
      const filter = { method: 'POST' };
      mockSendMessage.mockResolvedValue({
        success: true,
        data: [],
      });

      await controller.getLogs(filter);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'getLogs',
        payload: { filter },
      });
    });
  });

  describe('clearLogs', () => {
    it('should clear logs successfully', async () => {
      mockSendMessage.mockResolvedValue({
        success: true,
        data: undefined,
      });

      await controller.clearLogs();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'clearLogs' });
    });
  });

  describe('exportData', () => {
    it('should export data successfully', async () => {
      const exportData: ExportData = {
        version: '1.0.0',
        exportDate: new Date(),
        rules: [],
        config: {
          globalPaused: false,
          logRetentionDays: 7,
          maxLogEntries: 1000,
          enableHTTPS: true,
          theme: 'auto',
        },
      };

      mockSendMessage.mockResolvedValue({
        success: true,
        data: exportData,
      });

      const result = await controller.exportData();

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'exportData' });
      expect(result).toEqual(exportData);
    });
  });

  describe('importData', () => {
    it('should import data successfully', async () => {
      const importData: ExportData = {
        version: '1.0.0',
        exportDate: new Date(),
        rules: [],
        config: {
          globalPaused: false,
          logRetentionDays: 7,
          maxLogEntries: 1000,
          enableHTTPS: true,
          theme: 'auto',
        },
      };

      const importResult = {
        success: true,
        importedRules: 5,
        skippedRules: 0,
        errors: [],
      };

      mockSendMessage.mockResolvedValue({
        success: true,
        data: importResult,
      });

      const result = await controller.importData(importData);

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'importData',
        payload: { data: importData },
      });
      expect(result).toEqual(importResult);
    });
  });

  describe('error handling', () => {
    it('should handle chrome.runtime.lastError', async () => {
      (global.chrome.runtime as any).lastError = { message: 'Runtime error' };
      mockSendMessage.mockRejectedValue(new Error('Some error'));

      await expect(controller.getRules()).rejects.toThrow('Runtime error');
    });

    it('should handle generic errors', async () => {
      mockSendMessage.mockRejectedValue(new Error('Network error'));

      await expect(controller.getRules()).rejects.toThrow('Network error');
    });
  });
});
