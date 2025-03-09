import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, configureLogger, createLogger } from './logger';

describe('Logger', () => {
  // Mock console methods
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset logger config to default
    configureLogger({
      minLevel: LogLevel.DEBUG,
      useColors: true,
      includeTimestamp: true,
    });
  });

  it('should create a logger with the specified context', () => {
    const logger = createLogger('TestContext');
    logger.info('Test message');

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[TestContext]'),
      undefined
    );
  });

  it('should log messages with different levels', () => {
    const logger = createLogger('Test');

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    expect(console.debug).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('should include timestamps in log messages', () => {
    const logger = createLogger('Test', { includeTimestamp: true });
    logger.info('Test message');

    // Expect ISO timestamp format
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[[\d-]+T[\d:.]+Z\]/),
      undefined
    );
  });

  it('should not output logs below minimum level', () => {
    configureLogger({ minLevel: LogLevel.WARN });
    const logger = createLogger('Test');

    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');

    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it('should include additional data when provided', () => {
    const logger = createLogger('Test');
    const testData = { id: 123, name: 'test' };

    logger.info('Message with data', testData);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Message with data'),
      testData
    );
  });

  it('should handle Error objects correctly', () => {
    const logger = createLogger('Test');
    const testError = new Error('Test error');

    logger.error(testError);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error: Test error'),
      expect.objectContaining({ stack: testError.stack })
    );
  });

  it('should create child loggers with nested context', () => {
    const parentLogger = createLogger('Parent');
    const childLogger = parentLogger.child('Child');

    childLogger.info('Child logger message');

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[Parent:Child]'),
      undefined
    );
  });
});
