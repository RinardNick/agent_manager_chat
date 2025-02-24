import { LLMConfig, ServerConfig } from '@rinardnick/client_mcp';

export interface MCPConfig {
  llm: {
    type: string;
    api_key: string;
    system_prompt: string;
    model: string;
  };
  max_tool_calls: number;
  servers: Record<string, ServerConfig>;
}

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export function validateConfig(config: unknown): MCPConfig {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Configuration must be an object');
  }

  const typedConfig = config as Record<string, unknown>;

  // Validate LLM config
  if (!typedConfig.llm || typeof typedConfig.llm !== 'object') {
    throw new ConfigValidationError('LLM configuration is required');
  }

  const llmConfig = typedConfig.llm as Record<string, unknown>;
  if (
    typeof llmConfig.type !== 'string' ||
    typeof llmConfig.api_key !== 'string' ||
    typeof llmConfig.system_prompt !== 'string' ||
    typeof llmConfig.model !== 'string'
  ) {
    throw new ConfigValidationError(
      'LLM configuration must include type, api_key, system_prompt, and model as strings'
    );
  }

  // Validate max_tool_calls
  if (
    typeof typedConfig.max_tool_calls !== 'number' ||
    typedConfig.max_tool_calls < 0
  ) {
    throw new ConfigValidationError(
      'max_tool_calls must be a non-negative number'
    );
  }

  // Validate servers section
  if (!typedConfig.servers || typeof typedConfig.servers !== 'object') {
    throw new ConfigValidationError('servers section is required');
  }

  const servers = typedConfig.servers as Record<string, unknown>;
  const validatedServers: Record<string, ServerConfig> = {};

  for (const [serverName, serverConfig] of Object.entries(servers)) {
    if (!serverConfig || typeof serverConfig !== 'object') {
      throw new ConfigValidationError(
        `Invalid server configuration for ${serverName}`
      );
    }

    const typedServerConfig = serverConfig as Record<string, unknown>;

    if (typeof typedServerConfig.command !== 'string') {
      throw new ConfigValidationError(
        `command is required for server ${serverName}`
      );
    }

    // Validate optional fields
    if (
      typedServerConfig.args !== undefined &&
      !Array.isArray(typedServerConfig.args)
    ) {
      throw new ConfigValidationError(
        `args must be an array of strings for server ${serverName}`
      );
    }

    if (
      typedServerConfig.env !== undefined &&
      (typeof typedServerConfig.env !== 'object' ||
        !Object.entries(typedServerConfig.env as object).every(
          ([_, value]) => typeof value === 'string'
        ))
    ) {
      throw new ConfigValidationError(
        `env must be an object with string values for server ${serverName}`
      );
    }

    validatedServers[serverName] = {
      command: typedServerConfig.command,
      args: (typedServerConfig.args || []) as string[],
      env: (typedServerConfig.env || {}) as Record<string, string>,
    };
  }

  return {
    llm: {
      type: llmConfig.type as string,
      api_key: llmConfig.api_key as string,
      system_prompt: llmConfig.system_prompt as string,
      model: llmConfig.model as string,
    },
    max_tool_calls: typedConfig.max_tool_calls as number,
    servers: validatedServers,
  };
}
