import mongoose from 'mongoose';
import config from './index.js';
import { loggerService } from '../utils/index.js';

/**
 * MongoDB connection configuration and management
 */
class Database {
  constructor() {
    this.mongoose = mongoose;
    this.isConnected = false;
    this.connection = null;
  }

  /**
   * Get MongoDB connection URI from environment variables
   * @returns {string} MongoDB connection URI
   */
  getMongoURI() {
    return config.mongodbUri;
  }

  /**
   * Connect to MongoDB database
   * @returns {Promise<mongoose.Connection>} MongoDB connection
   */
  async connect() {
    if (this.isConnected) {
      loggerService.getLogger().info('Using existing database connection');
      return this.connection;
    }

    try {
      const mongoURI = this.getMongoURI();
      const options = {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      };

      // Log connection attempt without exposing the full URI
      loggerService.getLogger().info('Connecting to MongoDB');

      await mongoose.connect(mongoURI, options);

      this.connection = mongoose.connection;
      this.isConnected = true;

      // Set up event listeners
      this.connection.on('connected', () => {
        loggerService.getLogger().info('MongoDB connected successfully');
      });

      this.connection.on('error', (err) => {
        loggerService.getLogger().error('MongoDB connection error:', err);
      });

      this.connection.on('disconnected', () => {
        loggerService.getLogger().warn('MongoDB disconnected');
        this.isConnected = false;
      });

      // Handle process termination (skip in test to avoid open handles)
      const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID;
      if (!isTest) {
        process.on('SIGINT', this.closeConnection.bind(this));
        process.on('SIGTERM', this.closeConnection.bind(this));
      }

      loggerService.getLogger().info('MongoDB connection established');
      return this.connection;
    } catch (error) {
      loggerService.getLogger().error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Close MongoDB connection
   * @returns {Promise<void>}
   */
  async closeConnection() {
    if (this.isConnected && this.connection) {
      try {
        await mongoose.disconnect();
        this.isConnected = false;
        loggerService.getLogger().info('MongoDB connection closed');
      } catch (error) {
        loggerService.getLogger().error('Error closing MongoDB connection:', error);
      }
    }
  }

  /**
   * Get the current connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Get the mongoose instance
   * @returns {mongoose} Mongoose instance
   */
  getMongoose() {
    return this.mongoose;
  }

  /**
   * Get the database connection
   * @returns {mongoose.Connection|null} Database connection
   */
  getConnection() {
    return this.connection;
  }
}

// Create and export a singleton instance
const database = new Database();
export default database;
