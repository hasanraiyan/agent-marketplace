import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import database from '../src/config/database.js';
import { loggerService } from '../src/utils/index.js';

describe('Database Configuration', () => {
  let mockLogger;
  let originalEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    loggerService.setLogger(mockLogger);
    jest.resetModules();
  });

  afterEach(async () => {
    // Close any real mongoose connection that tests may have opened
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
    } catch (err) {
      // Ignore
    }
    // Reset database connection state
    database.isConnected = false;
    database.connection = null;
    // Restore environment
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  afterAll(() => {
    loggerService.setLogger(loggerService.getLogger()); // restore original
  });

  describe('getMongoURI', () => {
    test('should return the URI from config', async () => {
      // In ESM, the config object is shared. We can temporarily modify it for the test.
      // However, it's better to just verify it returns what is currently in config.
      const { default: config } = await import('../src/config/index.js');
      const uri = database.getMongoURI();
      expect(uri).toBe(config.mongodbUri);
    });
  });

  describe('connect', () => {
    test('should log connection attempt', async () => {
      // We'll test that the method exists and can be called
      // Actual connection test would require MongoDB server
      expect(typeof database.connect).toBe('function');

      // The method should attempt to connect and may throw if no MongoDB
      // We'll catch any error since we're not testing actual connection
      try {
        await database.connect();
      } catch (error) {
        // Expected if no MongoDB server
      }

      // At least the method should have attempted to log
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Connecting to MongoDB')
      );
    }, 10000);

    test('should return existing connection if already connected', async () => {
      // Simulate already connected
      database.isConnected = true;
      database.connection = { db: { databaseName: 'test' } };

      const connection = await database.connect();
      expect(connection).toEqual({ db: { databaseName: 'test' } });
      expect(mockLogger.info).toHaveBeenCalledWith('Using existing database connection');
    });

    test('should log error and throw when connection fails', async () => {
      const mockError = new Error('Connection failed');
      const mockConnect = jest.fn().mockRejectedValue(mockError);

      // Mock mongoose.connect to throw an error
      const originalConnect = database.mongoose.connect;
      database.mongoose.connect = mockConnect;

      try {
        await database.connect();
      } catch (error) {
        expect(error).toBe(mockError);
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to connect to MongoDB:', mockError);
      }

      // Restore original connect
      database.mongoose.connect = originalConnect;
    });

    test('should set up error event listener on connection', async () => {
      const mockError = new Error('Connection error');
      let errorHandler;

      // Mock mongoose.connection with event listeners that capture handlers
      const mockConnection = {
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            errorHandler = handler;
          }
        }),
      };

      const originalConnect = database.mongoose.connect;

      // Mock mongoose.connect to resolve
      database.mongoose.connect = jest.fn().mockResolvedValue();

      // Mock mongoose.connection getter
      const originalConnectionGetter = Object.getOwnPropertyDescriptor(
        database.mongoose,
        'connection'
      );

      Object.defineProperty(database.mongoose, 'connection', {
        get: () => mockConnection,
        configurable: true,
      });

      database.isConnected = false;
      database.connection = null;

      try {
        await database.connect();
      } catch (error) {
        // Ignore errors
      }

      // Verify error handler was registered
      expect(mockConnection.on).toHaveBeenCalledWith('error', expect.any(Function));

      // Invoke the error handler to test the callback
      errorHandler(mockError);
      expect(mockLogger.error).toHaveBeenCalledWith('MongoDB connection error:', mockError);

      // Restore
      database.mongoose.connect = originalConnect;
      if (originalConnectionGetter) {
        Object.defineProperty(database.mongoose, 'connection', originalConnectionGetter);
      } else {
        delete database.mongoose.connection;
      }
    });

    test('should set up disconnected event listener on connection', async () => {
      let disconnectHandler;

      // Mock mongoose.connection with event listeners that capture handlers
      const mockConnection = {
        on: jest.fn((event, handler) => {
          if (event === 'disconnected') {
            disconnectHandler = handler;
          }
        }),
      };

      const originalConnect = database.mongoose.connect;

      // Mock mongoose.connect to resolve
      database.mongoose.connect = jest.fn().mockResolvedValue();

      // Mock mongoose.connection getter
      const originalConnectionGetter = Object.getOwnPropertyDescriptor(
        database.mongoose,
        'connection'
      );

      Object.defineProperty(database.mongoose, 'connection', {
        get: () => mockConnection,
        configurable: true,
      });

      database.isConnected = false;
      database.connection = null;

      try {
        await database.connect();
      } catch (error) {
        // Ignore errors
      }

      // Verify disconnected handler was registered
      expect(mockConnection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));

      // Invoke the disconnected handler to test the callback
      database.isConnected = true;
      disconnectHandler();
      expect(mockLogger.warn).toHaveBeenCalledWith('MongoDB disconnected');
      expect(database.isConnected).toBe(false);

      // Restore
      database.mongoose.connect = originalConnect;
      if (originalConnectionGetter) {
        Object.defineProperty(database.mongoose, 'connection', originalConnectionGetter);
      } else {
        delete database.mongoose.connection;
      }
    });

    test('should set up connected event listener on connection', async () => {
      let connectedHandler;

      // Mock mongoose.connection with event listeners that capture handlers
      const mockConnection = {
        on: jest.fn((event, handler) => {
          if (event === 'connected') {
            connectedHandler = handler;
          }
        }),
      };

      const originalConnect = database.mongoose.connect;

      // Mock mongoose.connect to resolve
      database.mongoose.connect = jest.fn().mockResolvedValue();

      // Mock mongoose.connection getter
      const originalConnectionGetter = Object.getOwnPropertyDescriptor(
        database.mongoose,
        'connection'
      );

      Object.defineProperty(database.mongoose, 'connection', {
        get: () => mockConnection,
        configurable: true,
      });

      database.isConnected = false;
      database.connection = null;

      try {
        await database.connect();
      } catch (error) {
        // Ignore errors
      }

      // Verify connected handler was registered
      expect(mockConnection.on).toHaveBeenCalledWith('connected', expect.any(Function));

      // Invoke the connected handler to test the callback
      connectedHandler();
      expect(mockLogger.info).toHaveBeenCalledWith('MongoDB connected successfully');

      // Restore
      database.mongoose.connect = originalConnect;
      if (originalConnectionGetter) {
        Object.defineProperty(database.mongoose, 'connection', originalConnectionGetter);
      } else {
        delete database.mongoose.connection;
      }
    });
  });

  describe('closeConnection', () => {
    test('should log when closing connection', async () => {
      // We'll just test that the method exists and can be called
      database.isConnected = true;
      database.connection = {};

      await database.closeConnection();

      expect(mockLogger.info).toHaveBeenCalledWith('MongoDB connection closed');
      expect(database.isConnected).toBe(false);
    });

    test('should not attempt to close if not connected', async () => {
      database.isConnected = false;

      await database.closeConnection();

      expect(mockLogger.info).not.toHaveBeenCalledWith('MongoDB connection closed');
    });

    test('should log error when closing connection fails', async () => {
      const mockError = new Error('Close connection failed');
      const mockDisconnect = jest.fn().mockRejectedValue(mockError);

      // Mock mongoose.disconnect to throw an error
      const originalDisconnect = database.mongoose.disconnect;
      database.mongoose.disconnect = mockDisconnect;

      database.isConnected = true;
      database.connection = {};

      await database.closeConnection();

      expect(mockLogger.error).toHaveBeenCalledWith('Error closing MongoDB connection:', mockError);

      // Restore original disconnect
      database.mongoose.disconnect = originalDisconnect;
    });
  });

  describe('getConnectionStatus', () => {
    test('should return false when not connected', () => {
      database.isConnected = false;
      expect(database.getConnectionStatus()).toBe(false);
    });

    test('should return true when connected', () => {
      database.isConnected = true;
      expect(database.getConnectionStatus()).toBe(true);
    });
  });

  describe('getMongoose and getConnection', () => {
    test('getMongoose should return mongoose instance', () => {
      const mongoose = database.getMongoose();
      expect(mongoose).toBeDefined();
      expect(typeof mongoose.Schema).toBe('function');
    });

    test('getConnection should return null when not connected', () => {
      database.isConnected = false;
      database.connection = null;
      expect(database.getConnection()).toBeNull();
    });

    test('getConnection should return connection when connected', () => {
      const mockConnection = { db: { databaseName: 'test' } };
      database.isConnected = true;
      database.connection = mockConnection;
      expect(database.getConnection()).toBe(mockConnection);
    });
  });
});
