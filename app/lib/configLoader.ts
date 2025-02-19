import fs from 'fs/promises';
import path from 'path';
import { MCPConfig, validateConfig } from './config';

export async function loadConfig(configPath: string): Promise<MCPConfig> {
  try {
    console.log('[CONFIG] Loading config from:', configPath);
    const configContent = await fs.readFile(configPath, 'utf-8');
    console.log('[CONFIG] Raw config content:', configContent);
    const config = JSON.parse(configContent);
    console.log('[CONFIG] Parsed config:', config);
    return validateConfig(config);
  } catch (error) {
    console.error('[CONFIG] Error loading config:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw new Error('Failed to load configuration: Unknown error');
  }
}

export async function getDefaultConfigPath(): Promise<string> {
  // First check if there's a config file in the current working directory
  const cwdConfig = path.join(process.cwd(), 'config.json');
  console.log('[CONFIG] Checking CWD config path:', cwdConfig);
  try {
    await fs.access(cwdConfig);
    console.log('[CONFIG] Found config in CWD:', cwdConfig);
    return cwdConfig;
  } catch {
    // If not found in cwd, check the app directory
    const appConfig = path.join(__dirname, '..', '..', 'config.json');
    console.log('[CONFIG] Checking app config path:', appConfig);
    try {
      await fs.access(appConfig);
      console.log('[CONFIG] Found config in app directory:', appConfig);
      return appConfig;
    } catch {
      console.error('[CONFIG] No config.json found in either location');
      throw new Error('No config.json found in current directory or app root');
    }
  }
}
