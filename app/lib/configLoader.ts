'use server';

import path from 'path';
import fs from 'fs';

// Define types to match the expected config format
export interface LLMConfig {
  type: string;
  api_key: string;
  model: string;
  system_prompt: string;
  thinking?: {
    enabled: boolean;
    budget_tokens?: number;
  };
}

export interface FullConfig {
  llm: LLMConfig;
  servers?: Record<string, any>;
  max_tool_calls?: number;
}

// Get default config path
export async function getDefaultConfigPath(): Promise<string> {
  if (process.env.CONFIG_PATH) {
    return process.env.CONFIG_PATH;
  }

  const rootConfigPath = path.resolve(process.cwd(), 'config.json');
  if (fs.existsSync(rootConfigPath)) {
    return rootConfigPath;
  }

  throw new Error('Could not find config file');
}

// Load config from file
export async function loadConfig(configPath: string): Promise<FullConfig> {
  try {
    if (fs.existsSync(configPath)) {
      const fileData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(fileData);

      if (!config.llm || !config.llm.api_key || !config.llm.type) {
        throw new Error('Invalid config: missing required LLM settings');
      }

      // Ensure system_prompt is always defined
      if (!config.llm.system_prompt) {
        config.llm.system_prompt = 'You are a helpful assistant.';
      }

      return config;
    } else {
      throw new Error(`Config file not found at ${configPath}`);
    }
  } catch (error: any) {
    throw new Error(`Error loading config: ${error.message}`);
  }
}
