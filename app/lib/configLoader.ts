import { loadConfig as loadMCPConfig, LLMConfig } from '@rinardnick/client_mcp';
import path from 'path';
import fs from 'fs';

// Function to get default config path
export async function getDefaultConfigPath(): Promise<string> {
  return (
    process.env.CONFIG_PATH ||
    path.resolve(process.cwd(), '.mcp', 'config.json')
  );
}

export async function loadConfig(configPath: string): Promise<LLMConfig> {
  try {
    // Check if file exists before trying to load
    if (!fs.existsSync(configPath)) {
      console.log(
        `[CONFIG] Config file not found at ${configPath}, falling back to environment variables`
      );
      return loadConfigFromEnv();
    }

    const config = await loadMCPConfig(configPath);
    return {
      type: config.llm.type,
      api_key: config.llm.api_key,
      model: config.llm.model,
      system_prompt: config.llm.system_prompt,
      servers: config.servers,
    };
  } catch (error) {
    console.log(
      `[CONFIG] Error loading config from ${configPath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    console.log('[CONFIG] Falling back to environment variables');
    return loadConfigFromEnv();
  }
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
