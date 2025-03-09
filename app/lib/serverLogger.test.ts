import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ServerLogger,
  LogLevel,
  configureServerLogger,
  createServerLogger,
} from './serverLogger';

describe('ServerLogger', () => {
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
    configureServerLogger({
      minLevel: LogLevel.DEBUG,
      includeTimestamp: true,
    });
  });

  it('should create a server logger with the specified context', () => {
    const logger = createServerLogger('ServerContext');
    logger.info('Test message');

    expect(console.info).toHaveBeenCalledTimes(1);
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[ServerContext]'),
      undefined
    );
  });

  it('should log messages with different levels', () => {
    const logger = createServerLogger('Server');

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
    const logger = createServerLogger('Server', { includeTimestamp: true });
    logger.info('Test message');

    // Expect ISO timestamp format
    expect(console.info).toHaveBeenCalledWith(
      expect.stringMatching(/\[[\d-]+T[\d:.]+Z\]/),
      undefined
    );
  });

  it('should not output logs below minimum level', () => {
    configureServerLogger({ minLevel: LogLevel.WARN });
    const logger = createServerLogger('Server');

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
    const logger = createServerLogger('Server');
    const testData = { id: 123, name: 'test' };

    logger.info('Message with data', testData);

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('Message with data'),
      testData
    );
  });

  it('should handle Error objects correctly', () => {
    const logger = createServerLogger('Server');
    const testError = new Error('Test error');

    logger.error(testError);

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error: Test error'),
      expect.objectContaining({ stack: testError.stack })
    );
  });

  it('should create child loggers with nested context', () => {
    const parentLogger = createServerLogger('API');
    const childLogger = parentLogger.child('Stream');

    childLogger.info('Child logger message');

    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[API:Stream]'),
      undefined
    );
  });
});
