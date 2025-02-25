import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadConfig, loadConfigFromEnv } from './configLoader';
import { LLMConfig } from '@rinardnick/client_mcp';

// Mock the client_mcp module
vi.mock('@rinardnick/client_mcp', () => ({
  loadConfig: vi.fn(),
  LLMConfig: undefined, // TypeScript type only
}));

describe('Config Loading', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.SYSTEM_PROMPT;
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

      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-key',
        model: 'test-model',
        system_prompt: 'test prompt',
        servers: {
          filesystem: {
            command: 'npx',
            args: ['test'],
            env: {},
          },
        },
      });

      expect(mockLoadConfig).toHaveBeenCalledWith('test-path');
    });

    it('should handle errors from client_mcp loadConfig', async () => {
      const { loadConfig: mockLoadConfig } = await import(
        '@rinardnick/client_mcp'
      );
      vi.mocked(mockLoadConfig).mockRejectedValue(new Error('Test error'));

      await expect(loadConfig('test-path')).rejects.toThrow('Test error');
    });
  });

  describe('loadConfigFromEnv', () => {
    it('should create config from environment variables', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';
      process.env.ANTHROPIC_MODEL = 'test-model';
      process.env.SYSTEM_PROMPT = 'test prompt';

      const config = loadConfigFromEnv();

      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-key',
        model: 'test-model',
        system_prompt: 'test prompt',
        servers: {
          filesystem: {
            command: 'npx',
            args: [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/workspace',
            ],
            env: {},
          },
          terminal: {
            command: 'npx',
            args: [
              '@rinardnick/mcp-terminal',
              '--allowed-commands',
              '[go,python3,uv,npm,npx,git,ls,cd,touch,mv,pwd,mkdir]',
            ],
            env: {},
          },
        },
      });
    });

    it('should use defaults when optional environment variables are not set', () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const config = loadConfigFromEnv();

      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-key',
        model: 'claude-3-sonnet-20240229',
        system_prompt: 'You are a helpful assistant.',
        servers: {
          filesystem: {
            command: 'npx',
            args: [
              '-y',
              '@modelcontextprotocol/server-filesystem',
              '/workspace',
            ],
            env: {},
          },
          terminal: {
            command: 'npx',
            args: [
              '@rinardnick/mcp-terminal',
              '--allowed-commands',
              '[go,python3,uv,npm,npx,git,ls,cd,touch,mv,pwd,mkdir]',
            ],
            env: {},
          },
        },
      });
    });

    it('should throw error when ANTHROPIC_API_KEY is not set', () => {
      expect(() => loadConfigFromEnv()).toThrow(
        'ANTHROPIC_API_KEY environment variable is required'
      );
    });
  });
});
