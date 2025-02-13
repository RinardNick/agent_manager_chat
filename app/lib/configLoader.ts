import fs from 'fs/promises';
import path from 'path';
import { MCPConfig, validateConfig } from './config';

export async function loadConfig(configPath: string): Promise<MCPConfig> {
  try {
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    return validateConfig(config);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw new Error('Failed to load configuration: Unknown error');
  }
}

export async function getDefaultConfigPath(): Promise<string> {
  // First check if there's a config file in the current working directory
  const cwdConfig = path.join(process.cwd(), 'config.json');
  try {
    await fs.access(cwdConfig);
    return cwdConfig;
  } catch {
    // If not found in cwd, check the app directory
    const appConfig = path.join(__dirname, '..', '..', 'config.json');
    try {
      await fs.access(appConfig);
      return appConfig;
    } catch {
      throw new Error('No config.json found in current directory or app root');
    }
  }
}
