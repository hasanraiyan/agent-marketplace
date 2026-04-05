import mongoose from 'mongoose';
import database from '../src/config/database.js';
import { afterAll } from '@jest/globals';

// Ensure MongoDB connection is closed after all tests to prevent open handles
afterAll(async () => {
  try {
    await database.closeConnection();
  } catch (err) {
    // Ignore errors during teardown
  }
  // Force-disconnect mongoose regardless of tracked state (catches leaked connections)
  try {
    await mongoose.disconnect();
  } catch (err) {
    // Ignore
  }
  // Clean up rate limiter setInterval timer
  try {
    const { default: rateLimiterService } = await import('../src/services/rateLimiter.service.js');
    rateLimiterService.destroy();
  } catch (err) {
    // Ignore
  }
});
