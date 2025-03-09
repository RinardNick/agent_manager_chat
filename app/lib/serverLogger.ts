'use server';

/**
 * Logging levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  includeTimestamp: boolean;
  context?: string;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  minLevel:
    process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  includeTimestamp: true,
};

/**
 * Global logger configuration
 */
let globalConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the global logger settings
 */
export function configureServerLogger(config: Partial<LoggerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get the current logging configuration
 */
export function getServerLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * Structured logger class for server-side use
 */
export class ServerLogger {
  private context: string;
  private config: LoggerConfig;

  /**
   * Create a new server logger instance
   * @param context The context for this logger (usually a component or module name)
   * @param config Optional configuration that overrides the global config
   */
  constructor(context: string, config?: Partial<LoggerConfig>) {
    this.context = context;
    this.config = { ...globalConfig, ...(config || {}), context };
  }

  /**
   * Log a debug message
   * @param message The message to log
   * @param data Optional data to include
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log an info message
   * @param message The message to log
   * @param data Optional data to include
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a warning message
   * @param message The message to log
   * @param data Optional data to include
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an error message
   * @param message The message or error to log
   * @param data Optional data to include
   */
  error(message: string | Error, data?: any): void {
    const errorMessage =
      message instanceof Error
        ? `${message.name}: ${message.message}`
        : message;
    const errorData =
      message instanceof Error
        ? { ...(data || {}), stack: message.stack }
        : data;

    this.log(LogLevel.ERROR, errorMessage, errorData);
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (level < this.config.minLevel) return;

    const timestamp = this.config.includeTimestamp
      ? new Date().toISOString()
      : '';
    const prefix = this.formatPrefix(level, timestamp);

    const formattedMessage = `${prefix} ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        data
          ? console.debug(formattedMessage, data)
          : console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        data
          ? console.info(formattedMessage, data)
          : console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        data
          ? console.warn(formattedMessage, data)
          : console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        data
          ? console.error(formattedMessage, data)
          : console.error(formattedMessage);
        break;
    }
  }

  /**
   * Format the log prefix
   */
  private formatPrefix(level: LogLevel, timestamp: string): string {
    const levelStr = LogLevel[level].padEnd(5);

    const contextStr = this.context ? `[${this.context}]` : '';
    const timestampStr = timestamp ? `[${timestamp}]` : '';

    return `${timestampStr}${levelStr}${contextStr}`;
  }

  /**
   * Create a child logger with a sub-context
   * @param subContext The sub-context to append
   */
  child(subContext: string): ServerLogger {
    return new ServerLogger(`${this.context}:${subContext}`, this.config);
  }
}

/**
 * Create a new server logger instance
 * @param context The context for this logger
 * @param config Optional configuration
 */
export function createServerLogger(
  context: string,
  config?: Partial<LoggerConfig>
): ServerLogger {
  return new ServerLogger(context, config);
}
