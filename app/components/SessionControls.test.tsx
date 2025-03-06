import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SessionControls from './SessionControls';
import * as sessionManager from '../lib/sessionManager';

// Mock the sessionManager module
vi.mock('../lib/sessionManager', () => ({
  getAllSessions: vi.fn(),
  getActiveSessionId: vi.fn(),
  setActiveSession: vi.fn(),
  initializeNewSession: vi.fn(),
  renameSession: vi.fn(),
  deleteSession: vi.fn(),
}));

describe('SessionControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mock implementations
    vi.mocked(sessionManager.getAllSessions).mockReturnValue([
      { id: 'session1', name: 'Session 1', createdAt: 1000, lastUsedAt: 2000 },
      { id: 'session2', name: 'Session 2', createdAt: 3000, lastUsedAt: 4000 },
    ]);
    vi.mocked(sessionManager.getActiveSessionId).mockReturnValue('session1');
    vi.mocked(sessionManager.setActiveSession).mockReturnValue(true);
    vi.mocked(sessionManager.initializeNewSession).mockResolvedValue({
      id: 'new-session',
      name: 'New Session',
      createdAt: 5000,
      lastUsedAt: 5000,
    });
    vi.mocked(sessionManager.renameSession).mockReturnValue(true);
    vi.mocked(sessionManager.deleteSession).mockReturnValue(true);
  });

  it('renders session dropdown with sessions from localStorage', () => {
    render(<SessionControls onActiveSessionChange={() => {}} />);
    
    // Session dropdown should be visible
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    
    // Should have options for both sessions
    expect(screen.getByText('Session 1')).toBeInTheDocument();
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('shows active session as selected', () => {
    render(<SessionControls onActiveSessionChange={() => {}} />);
    
    // The active session should be selected in the dropdown
    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('session1');
  });

  it('changes active session when dropdown selection changes', async () => {
    const mockOnChange = vi.fn();
    render(<SessionControls onActiveSessionChange={mockOnChange} />);
    
    // Change the selection
    fireEvent.change(screen.getByRole('combobox'), { 
      target: { value: 'session2' } 
    });
    
    // Should call setActiveSession
    expect(sessionManager.setActiveSession).toHaveBeenCalledWith('session2');
    
    // Should call the change handler
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('creates a new session when new session button is clicked', async () => {
    const mockOnChange = vi.fn();
    render(<SessionControls onActiveSessionChange={mockOnChange} />);
    
    // Click the new session button
    fireEvent.click(screen.getByRole('button', { name: /new/i }));
    
    // Should call initializeNewSession
    expect(sessionManager.initializeNewSession).toHaveBeenCalled();
    
    // Should call the change handler
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
  });

  it('renames the active session when rename button is clicked', async () => {
    // Mock window.prompt
    const originalPrompt = window.prompt;
    window.prompt = vi.fn(() => 'Renamed Session');
    
    const mockOnChange = vi.fn();
    render(<SessionControls onActiveSessionChange={mockOnChange} />);
    
    // Click the rename button
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    
    // Should call window.prompt
    expect(window.prompt).toHaveBeenCalled();
    
    // Should call renameSession
    expect(sessionManager.renameSession).toHaveBeenCalledWith('session1', 'Renamed Session');
    
    // Should call the change handler
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
    
    // Restore original prompt
    window.prompt = originalPrompt;
  });

  it('deletes the active session when delete button is clicked and confirmed', async () => {
    // Mock window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    
    const mockOnChange = vi.fn();
    render(<SessionControls onActiveSessionChange={mockOnChange} />);
    
    // Click the delete button
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    // Should call window.confirm
    expect(window.confirm).toHaveBeenCalled();
    
    // Should call deleteSession
    expect(sessionManager.deleteSession).toHaveBeenCalledWith('session1');
    
    // Should call the change handler
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled();
    });
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });

  it('does not delete the session if not confirmed', () => {
    // Mock window.confirm to return false
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => false);
    
    render(<SessionControls onActiveSessionChange={() => {}} />);
    
    // Click the delete button
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    
    // Should call window.confirm
    expect(window.confirm).toHaveBeenCalled();
    
    // Should NOT call deleteSession
    expect(sessionManager.deleteSession).not.toHaveBeenCalled();
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });
});