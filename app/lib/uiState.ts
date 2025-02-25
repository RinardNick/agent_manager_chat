export interface UIState {
  isLoading: boolean;
  isThinking: boolean;
  error: string | null;
  currentTool?: string;
}

export interface UIStateUpdate extends Partial<UIState> {}

export class UIStateManager {
  private states: Map<string, UIState>;

  constructor() {
    this.states = new Map();
  }

  getState(sessionId: string): UIState | null {
    return this.states.get(sessionId) || null;
  }

  initializeState(sessionId: string): UIState {
    const initialState: UIState = {
      isLoading: false,
      isThinking: false,
      error: null,
    };
    this.states.set(sessionId, initialState);
    return initialState;
  }

  updateState(sessionId: string, update: UIStateUpdate): UIState {
    const currentState = this.states.get(sessionId);
    if (!currentState) {
      throw new Error(`No UI state found for session ${sessionId}`);
    }

    const newState = { ...currentState, ...update };
    this.states.set(sessionId, newState);
    return newState;
  }

  clearError(sessionId: string): void {
    const currentState = this.states.get(sessionId);
    if (currentState) {
      currentState.error = null;
      this.states.set(sessionId, currentState);
    }
  }

  setError(sessionId: string, error: string): void {
    const currentState = this.states.get(sessionId);
    if (currentState) {
      currentState.error = error;
      currentState.isLoading = false;
      currentState.isThinking = false;
      this.states.set(sessionId, currentState);
    }
  }

  deleteState(sessionId: string): void {
    this.states.delete(sessionId);
  }

  getAllSessionIds(): string[] {
    return Array.from(this.states.keys());
  }
}
