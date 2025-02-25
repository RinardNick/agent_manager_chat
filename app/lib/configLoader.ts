import { loadConfig as loadMCPConfig, LLMConfig } from '@rinardnick/client_mcp';

export async function loadConfig(configPath: string): Promise<LLMConfig> {
  const config = await loadMCPConfig(configPath);
  return {
    type: config.llm.type,
    api_key: config.llm.api_key,
    model: config.llm.model,
    system_prompt: config.llm.system_prompt,
    servers: config.servers,
  };
}

// Export a convenience function to load config from environment variables
export function loadConfigFromEnv(): LLMConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  return {
    type: 'claude',
    api_key: apiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    system_prompt: process.env.SYSTEM_PROMPT || 'You are a helpful assistant.',
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
