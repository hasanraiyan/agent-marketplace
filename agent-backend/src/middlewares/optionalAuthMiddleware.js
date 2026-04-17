import { clerkMiddleware } from '@clerk/express';
import User from '../models/User.js';

const baseClerkMiddleware = clerkMiddleware();

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // Run Clerk's middleware which will populate req.auth without failing if missing
    await new Promise((resolve, reject) => {
      baseClerkMiddleware(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    if (req.auth && req.auth.userId) {
      const user = await User.findOne({ clerkId: req.auth.userId });
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

export default optionalAuthMiddleware;
