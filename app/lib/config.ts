import {
  LLMConfig,
  ServerConfig,
  ConfigurationError,
} from '@rinardnick/client_mcp';

export { ConfigurationError };
export type { LLMConfig, ServerConfig };

// Export a helper function to create a config with defaults
export function createConfig(
  apiKey: string,
  model = 'claude-3-sonnet-20240229',
  systemPrompt = 'You are a helpful assistant.',
  maxToolCalls = 10
): LLMConfig {
  return {
    type: 'claude',
    api_key: apiKey,
    model,
    system_prompt: systemPrompt,
    servers: {
      filesystem: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
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
  };
}
