import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ServerManager } from './serverManager';
import { ServerConfig } from './config';
import { ChildProcess } from 'child_process';
import * as childProcess from 'child_process';

// Create mock process
const mockProcess = {
  kill: vi.fn(),
  on: vi.fn(),
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
};

// Setup default event handlers to prevent errors
mockProcess.on.mockImplementation((event: string, handler: Function) => {
  if (event === 'error') {
    // Don't call error handler by default
  }
  return mockProcess;
});

// Mock the child_process module
vi.mock('child_process', () => {
  const mock = {
    spawn: vi.fn(() => mockProcess),
    ChildProcess: vi.fn(),
  };
  return {
    __esModule: true,
    ...mock,
    default: mock,
  };
});

// Mock fetch for health checks and capability discovery
global.fetch = vi.fn();

describe('ServerManager', () => {
  let serverManager: ServerManager;
  const mockConfig: Record<string, ServerConfig> = {
    fileSystem: {
      command: 'node',
      args: ['server.js'],
      env: {
        PORT: '3001',
        SERVER_TYPE: 'filesystem',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    serverManager = new ServerManager(mockConfig);
    (global.fetch as Mock).mockReset();
    mockProcess.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'error') {
        // Don't call error handler by default
      }
      return mockProcess;
    });
  });

  it('should launch servers with correct configuration', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [] }),
      });

    await serverManager.launchServers();

    expect(childProcess.spawn).toHaveBeenCalledWith(
      'node',
      ['server.js'],
      expect.objectContaining({
        env: expect.objectContaining({
          PORT: '3001',
          SERVER_TYPE: 'filesystem',
        }),
      })
    );
  });

  it('should perform health checks on launched servers', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [] }),
      });

    await serverManager.launchServers();

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3001/health',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );
  });

  it('should discover server capabilities after successful health check', async () => {
    const mockCapabilities = {
      tools: [
        {
          name: 'readFile',
          description: 'Reads a file from the filesystem',
        },
      ],
    };

    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCapabilities),
      });

    await serverManager.launchServers();

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3001/tools/list',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
    );

    const capabilities = serverManager.getCapabilities('fileSystem');
    expect(capabilities).toEqual(mockCapabilities);
  });

  it('should handle server launch failures', async () => {
    mockProcess.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'error') {
        handler(new Error('Failed to launch server'));
      }
      return mockProcess;
    });

    await expect(serverManager.launchServers()).rejects.toThrow(
      'Failed to launch server'
    );
  });

  it('should handle health check failures', async () => {
    (global.fetch as Mock).mockRejectedValueOnce(
      new Error('Health check failed')
    );

    await expect(serverManager.launchServers()).rejects.toThrow(
      'Health check failed for server fileSystem'
    );
  });

  it('should handle capability discovery failures', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
      .mockRejectedValueOnce(new Error('Failed to fetch capabilities'));

    await expect(serverManager.launchServers()).rejects.toThrow(
      'Failed to discover capabilities for server fileSystem'
    );
  });

  it('should clean up servers on shutdown', async () => {
    (global.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tools: [] }),
      });

    await serverManager.launchServers();
    await serverManager.shutdown();

    expect(mockProcess.kill).toHaveBeenCalled();
  });
});
