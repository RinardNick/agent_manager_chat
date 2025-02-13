import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { loadConfig, getDefaultConfigPath } from './configLoader';
import { ConfigValidationError } from './config';

vi.mock('fs/promises');
vi.mock('path', () => {
  return {
    default: {
      join: vi.fn(),
    },
    join: vi.fn(),
  };
});

describe('Configuration Loader', () => {
  const mockFs = fs as unknown as {
    readFile: ReturnType<typeof vi.fn>;
    access: ReturnType<typeof vi.fn>;
  };
  const validConfig = {
    llm: {
      type: 'claude',
      model: 'claude-3-sonnet-20240229',
      api_key: 'test-key',
      system_prompt: 'You are a helpful assistant.',
    },
    max_tool_calls: 10,
    servers: {
      fileSystem: {
        command: 'node',
        args: ['server.js'],
        env: {
          PORT: '3001',
          SERVER_TYPE: 'filesystem',
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(process, 'cwd').mockReturnValue('/current/working/dir');
  });

  describe('loadConfig', () => {
    it('should load a valid configuration file', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue(JSON.stringify(validConfig));

      const config = await loadConfig('config.json');
      expect(config).toEqual(validConfig);
      expect(mockFs.readFile).toHaveBeenCalledWith('config.json', 'utf-8');
    });

    it('should throw error for invalid JSON', async () => {
      vi.mocked(mockFs.readFile).mockResolvedValue('invalid json');

      await expect(loadConfig('config.json')).rejects.toThrow(
        'Failed to load configuration'
      );
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        llm: {
          type: 'claude',
          // Missing required fields
        },
      };

      vi.mocked(mockFs.readFile).mockResolvedValue(
        JSON.stringify(invalidConfig)
      );

      await expect(loadConfig('config.json')).rejects.toThrow(
        'Failed to load configuration'
      );
    });
  });

  describe('getDefaultConfigPath', () => {
    it('should return config path from current working directory if exists', async () => {
      const cwdPath = '/current/working/dir';
      const expectedPath = '/current/working/dir/config.json';

      vi.mocked(path.join).mockReturnValueOnce(expectedPath);
      vi.mocked(mockFs.access).mockResolvedValueOnce(undefined);

      const configPath = await getDefaultConfigPath();
      expect(configPath).toBe(expectedPath);
      expect(mockFs.access).toHaveBeenCalledWith(expectedPath);
    });

    it('should return config path from app directory if not in cwd', async () => {
      const cwdPath = '/current/working/dir';
      const appPath = '/app/root/config.json';

      vi.mocked(path.join)
        .mockReturnValueOnce('/current/working/dir/config.json')
        .mockReturnValueOnce(appPath);

      vi.mocked(mockFs.access)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(undefined);

      const configPath = await getDefaultConfigPath();
      expect(configPath).toBe(appPath);
      expect(mockFs.access).toHaveBeenCalledTimes(2);
    });

    it('should throw error if config not found in either location', async () => {
      vi.mocked(mockFs.access).mockRejectedValue(new Error('Not found'));

      await expect(getDefaultConfigPath()).rejects.toThrow(
        'No config.json found'
      );
    });
  });
});
