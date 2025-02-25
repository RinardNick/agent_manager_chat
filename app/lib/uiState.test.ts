import { describe, it, expect, beforeEach } from 'vitest';
import { UIStateManager } from './uiState';

describe('UI State Management', () => {
  let uiStateManager: UIStateManager;
  const testSessionId = 'test-session';

  beforeEach(() => {
    uiStateManager = new UIStateManager();
  });

  describe('State Initialization', () => {
    it('should initialize state with default values', () => {
      const state = uiStateManager.initializeState(testSessionId);

      expect(state).toEqual({
        isLoading: false,
        isThinking: false,
        error: null,
      });
    });

    it('should return null for non-existent session state', () => {
      const state = uiStateManager.getState('non-existent');
      expect(state).toBeNull();
    });
  });

  describe('State Updates', () => {
    it('should update state partially', () => {
      uiStateManager.initializeState(testSessionId);
      const updatedState = uiStateManager.updateState(testSessionId, {
        isLoading: true,
      });

      expect(updatedState).toEqual({
        isLoading: true,
        isThinking: false,
        error: null,
      });
    });

    it('should throw error when updating non-existent session', () => {
      expect(() =>
        uiStateManager.updateState('non-existent', { isLoading: true })
      ).toThrow(/No UI state found/);
    });

    it('should preserve unmodified fields', () => {
      const initial = uiStateManager.initializeState(testSessionId);
      initial.currentTool = 'test-tool';

      const updated = uiStateManager.updateState(testSessionId, {
        isThinking: true,
      });

      expect(updated).toEqual({
        isLoading: false,
        isThinking: true,
        error: null,
        currentTool: 'test-tool',
      });
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      uiStateManager.initializeState(testSessionId);
      uiStateManager.setError(testSessionId, 'Test error');

      const state = uiStateManager.getState(testSessionId);
      expect(state).toEqual({
        isLoading: false,
        isThinking: false,
        error: 'Test error',
      });
    });

    it('should clear error state', () => {
      uiStateManager.initializeState(testSessionId);
      uiStateManager.setError(testSessionId, 'Test error');
      uiStateManager.clearError(testSessionId);

      const state = uiStateManager.getState(testSessionId);
      expect(state?.error).toBeNull();
    });

    it('should handle error operations on non-existent session', () => {
      // Should not throw
      uiStateManager.setError('non-existent', 'Test error');
      uiStateManager.clearError('non-existent');
    });
  });

  describe('State Cleanup', () => {
    it('should delete session state', () => {
      uiStateManager.initializeState(testSessionId);
      uiStateManager.deleteState(testSessionId);

      expect(uiStateManager.getState(testSessionId)).toBeNull();
    });

    it('should handle deleting non-existent session', () => {
      // Should not throw
      uiStateManager.deleteState('non-existent');
    });
  });

  describe('Session Management', () => {
    it('should list all session IDs', () => {
      uiStateManager.initializeState('session1');
      uiStateManager.initializeState('session2');

      const sessions = uiStateManager.getAllSessionIds();
      expect(sessions).toHaveLength(2);
      expect(sessions).toContain('session1');
      expect(sessions).toContain('session2');
    });

    it('should return empty array when no sessions exist', () => {
      const sessions = uiStateManager.getAllSessionIds();
      expect(sessions).toHaveLength(0);
    });
  });
});
