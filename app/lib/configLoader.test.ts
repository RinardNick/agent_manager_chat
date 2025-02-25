import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, loadConfigFromEnv, FullConfig } from './configLoader';
import { LLMConfig } from '@rinardnick/client_mcp';

// Mock the client_mcp module
vi.mock('@rinardnick/client_mcp', () => ({
  loadConfig: vi.fn(),
  LLMConfig: undefined, // TypeScript type only
}));

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}));

describe('Config Loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.SYSTEM_PROMPT;
    delete process.env.CONFIG_PATH;
  });

  describe('loadConfig', () => {
    it('should load and transform config from file', async () => {
      const mockMCPConfig = {
        llm: {
          type: 'claude',
          api_key: 'test-key',
          model: 'test-model',
          system_prompt: 'test prompt',
        },
        servers: {
          filesystem: {
            command: 'npx',
            args: ['test'],
            env: {},
          },
        },
      };

      const { loadConfig: mockLoadConfig } = await import(
        '@rinardnick/client_mcp'
      );
      vi.mocked(mockLoadConfig).mockResolvedValue(mockMCPConfig);

      const config = await loadConfig('test-path');

      // Check that we get back the same structure as mockMCPConfig
      expect(config).toEqual(mockMCPConfig);
      expect(mockLoadConfig).toHaveBeenCalledWith('test-path');
    });

    it('should handle errors from client_mcp loadConfig', async () => {
      // Mock filesystem to return true for file existence
      const fs = await import('fs');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      // Set API key to avoid the environment variable error
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const { loadConfig: mockLoadConfig } = await import(
        '@rinardnick/client_mcp'
      );
      vi.mocked(mockLoadConfig).mockRejectedValue(new Error('Test error'));

      const config = await loadConfig('test-path');

      // Should return a valid config from environment since file loading failed
      expect(config).toHaveProperty('llm');
      expect(config.llm.api_key).toBe('test-key');
    });
  });

  describe('loadConfigFromEnv', () => {
    it('should create config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.ANTHROPIC_MODEL = 'test-model';
      process.env.SYSTEM_PROMPT = 'test prompt';

      const config = loadConfigFromEnv();

      // Check that we get back just the LLMConfig part
      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-key',
        model: 'test-model',
        system_prompt: 'test prompt',
      });
    });

    it('should use defaults when optional environment variables are not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const config = loadConfigFromEnv();

      // Check that we get back just the LLMConfig part with defaults
      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-key',
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
      });
    });

    it('should throw error when ANTHROPIC_API_KEY is not set', () => {
      expect(() => loadConfigFromEnv()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required'
      );
    });
  });
});
