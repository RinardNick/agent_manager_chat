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

  // Default path as the last resort
  return path.resolve(process.cwd(), '.mcp', 'config.json');
}

export async function loadConfig(configPath: string): Promise<FullConfig> {
  try {
    // Attempt to load the config directly from the specified path
    let config;

    try {
      // Try to load with client_mcp loader first
      config = await loadMCPConfig(configPath);
    } catch (error: any) {
      // If that fails, try to load the file directly
      console.log(
        `[CONFIG] Failed to load with client_mcp loader: ${error.message}`
      );
      console.log(
        `[CONFIG] Attempting to load config file directly: ${configPath}`
      );

      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(fileContent);
      } else {
        console.log(
          `[CONFIG] Config file not found at ${configPath}, falling back to environment variables`
        );
        return getEnvConfig();
      }
    }

    // Keep the nested structure if it already exists
    if (config.llm) {
      // Config already has the expected structure with llm object
      return config as FullConfig;
    } else if (config.type) {
      // Config is in the flattened format, convert to nested
      return {
        llm: config as LLMConfig,
        servers: config.servers || {},
        max_tool_calls: 10,
      };
    } else {
      console.log(
        '[CONFIG] Config has unexpected format, falling back to environment variables'
      );
      return getEnvConfig();
    }
  } catch (error: any) {
    console.log(`[CONFIG] Error loading config: ${error.message}`);
    return getEnvConfig();
  }
}

// Export a function to get config from environment variables in the correct structure
function getEnvConfig(): FullConfig {
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
export function loadConfigFromEnv(): LLMConfig {
  return getEnvConfig().llm;
}
