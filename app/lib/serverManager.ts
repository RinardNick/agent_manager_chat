import { spawn, ChildProcess } from 'child_process';
import { ServerConfig } from './config';

interface ServerInstance {
  process: ChildProcess;
  capabilities: any;
  port: string;
}

export class ServerManager {
  private servers: Record<string, ServerInstance> = {};

  constructor(private config: Record<string, ServerConfig>) {}

  public async launchServers(): Promise<void> {
    for (const [serverName, serverConfig] of Object.entries(this.config)) {
      try {
        // Launch the server process
        const serverProcess = this.launchServer(serverConfig);
        const port = serverConfig.env?.PORT || '3000';

        // Store server instance
        this.servers[serverName] = {
          process: serverProcess,
          capabilities: null,
          port,
        };

        // Wait for server to be healthy
        await this.waitForHealthy(serverName);

        // Discover capabilities
        await this.discoverCapabilities(serverName);
      } catch (error) {
        // Clean up any launched servers before throwing
        await this.shutdown();
        throw error;
      }
    }
  }

  public getCapabilities(serverName: string): any {
    return this.servers[serverName]?.capabilities;
  }

  public async shutdown(): Promise<void> {
    for (const server of Object.values(this.servers)) {
      if (server.process) {
        server.process.kill();
      }
    }
    this.servers = {};
  }

  private launchServer(config: ServerConfig): ChildProcess {
    try {
      const childProcess = spawn(config.command, config.args || [], {
        env: {
          ...process.env,
          ...config.env,
        },
      });

      // Handle process events
      childProcess.on('error', (error: Error) => {
        console.error('Server process error:', error);
        throw error;
      });

      childProcess.stdout?.on('data', (data: Buffer) => {
        console.log('Server stdout:', data.toString());
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        console.error('Server stderr:', data.toString());
      });

      return childProcess;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'Failed to launch server'
      );
    }
  }

  private async waitForHealthy(serverName: string): Promise<void> {
    const server = this.servers[serverName];
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    try {
      const response = await fetch(`http://localhost:${server.port}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== 'healthy') {
        throw new Error(`Server reported unhealthy status: ${data.status}`);
      }
    } catch (error) {
      throw new Error(
        `Health check failed for server ${serverName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  private async discoverCapabilities(serverName: string): Promise<void> {
    const server = this.servers[serverName];
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    try {
      const response = await fetch(
        `http://localhost:${server.port}/tools/list`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Capability discovery failed with status ${response.status}`
        );
      }

      const capabilities = await response.json();
      server.capabilities = capabilities;
    } catch (error) {
      throw new Error(
        `Failed to discover capabilities for server ${serverName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
