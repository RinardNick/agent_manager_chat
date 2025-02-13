import { describe, it, expect } from 'vitest';
import { validateConfig } from './config';

describe('Configuration Validation', () => {
  it('should accept valid configuration with servers section', () => {
    const config = {
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
        codeSearch: {
          command: 'node',
          args: ['server.js'],
          env: {
            PORT: '3002',
            SERVER_TYPE: 'codesearch',
          },
        },
      },
    };

    expect(() => validateConfig(config)).not.toThrow();
    const validatedConfig = validateConfig(config);
    expect(validatedConfig.max_tool_calls).toBe(10);
    expect(validatedConfig.servers).toBeDefined();
    expect(Object.keys(validatedConfig.servers)).toHaveLength(2);
    expect(validatedConfig.llm.api_key).toBe('test-key');
    expect(validatedConfig.llm.system_prompt).toBe(
      'You are a helpful assistant.'
    );
  });

  it('should reject configuration without servers section', () => {
    const config = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: 10,
    };

    expect(() => validateConfig(config)).toThrow(
      /servers section is required/i
    );
  });

  it('should reject configuration with invalid server configuration', () => {
    const config = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: 10,
      servers: {
        fileSystem: {
          // Missing required command field
          args: ['server.js'],
          env: {
            PORT: '3001',
          },
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(/command is required/i);
  });

  it('should reject configuration with negative max_tool_calls', () => {
    const config = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      max_tool_calls: -1,
      servers: {
        fileSystem: {
          command: 'node',
          args: ['server.js'],
          env: {
            PORT: '3001',
          },
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(
      /max_tool_calls must be a non-negative number/i
    );
  });

  it('should reject configuration with missing max_tool_calls', () => {
    const config = {
      llm: {
        type: 'claude',
        model: 'claude-3-sonnet-20240229',
        api_key: 'test-key',
        system_prompt: 'You are a helpful assistant.',
      },
      servers: {
        fileSystem: {
          command: 'node',
          args: ['server.js'],
          env: {
            PORT: '3001',
          },
        },
      },
    };

    expect(() => validateConfig(config)).toThrow(
      /max_tool_calls must be a non-negative number/i
    );
  });
});
