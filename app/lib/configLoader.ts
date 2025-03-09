'use server';

import { loadConfig as loadMCPConfig, LLMConfig } from '@rinardnick/client_mcp';
import path from 'path';
import fs from 'fs';

// Define types to match the route's expectations
export interface FullConfig {
  llm: LLMConfig;
  servers: Record<string, any>;
  max_tool_calls?: number;
}

// Function to get default config path
export async function getDefaultConfigPath(): Promise<string> {
  // Check if environment variable is set
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  // Check if .mcp/config.json exists
  const mcpConfigPath = path.resolve(process.cwd(), '.mcp', 'config.json');
  if (fs.existsSync(mcpConfigPath)) {
    return mcpConfigPath;
  }

  // Fallback to root config.json
  const rootConfigPath = path.resolve(process.cwd(), 'config.json');
  if (fs.existsSync(rootConfigPath)) {
    return rootConfigPath;
  }

  throw new Error('Could not find config file');
}

export async function loadConfig(configPath: string): Promise<FullConfig> {
  try {
    // Check if the file exists and is readable
    if (fs.existsSync(configPath)) {
      // Read the file
      const fileData = fs.readFileSync(configPath, 'utf8');

      // Parse and validate the config
      try {
        const config = JSON.parse(fileData);

        // Validate required fields
        if (!config.llm || !config.llm.api_key) {
          console.log(
            '[CONFIG] Warning: Missing required llm.api_key in config file'
          );
          return await getEnvConfig();
        }

        if (!config.llm.type) {
          console.log('[CONFIG] Warning: Missing llm.type in config file');
          return await getEnvConfig();
        }

        if (!config.servers) {
          config.servers = {
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
          };
        }

        return config;
      } catch (err) {
        console.log('[CONFIG] Error parsing config file:', err);
        return await getEnvConfig();
      }
    } else {
      console.log(`[CONFIG] Config file not found at ${configPath}`);
      return await getEnvConfig();
    }
  } catch (error: any) {
    console.log(`[CONFIG] Error loading config: ${error.message}`);
    return await getEnvConfig();
  }
}

// Export a function to get config from environment variables in the correct structure
async function getEnvConfig(): Promise<FullConfig> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const llmConfig: LLMConfig = {
    type: 'claude',
    api_key: apiKey,
    model: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
    system_prompt: process.env.SYSTEM_PROMPT || 'You are a helpful assistant.',
  };

  return {
    llm: llmConfig,
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
    max_tool_calls: 10,
  };
}

// Keep the original function for backward compatibility, but use nested structure internally
export async function loadConfigFromEnv(): Promise<LLMConfig> {
  return (await getEnvConfig()).llm;
}
