import { describe, it, expect } from 'vitest';
import { createConfig } from './config';

describe('Config Management', () => {
  describe('createConfig', () => {
    it('should create a valid config with defaults', () => {
      const config = createConfig('test-api-key');

      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-api-key',
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

    it('should allow overriding defaults', () => {
      const config = createConfig(
        'test-api-key',
        'custom-model',
        'Custom prompt',
        5
      );

      expect(config).toEqual({
        type: 'claude',
        api_key: 'test-api-key',
        model: 'custom-model',
        system_prompt: 'Custom prompt',
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
  });
});
