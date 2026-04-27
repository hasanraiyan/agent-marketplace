import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import User from '../models/User.js';
import { loggerService } from '../utils/index.js';
import fs from 'fs';

const baseClerkMiddleware = clerkMiddleware();
const logger = loggerService.getLogger();

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    // 1. Extract auth state (populated by global clerkMiddleware)
    const authState = getAuth(req);
    const clerkId = authState?.userId;
    
    try {
      fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth clerkId: ${clerkId}\n`);
    } catch (e) {}

    if (clerkId) {
      let user = await User.findOne({ clerkId });
      
      if (user) {
        try {
          fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth found user: ${user.id}\n`);
        } catch (e) {}
      } else {
        try {
          fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth user NOT cached for clerkId: ${clerkId}, attempting sync...\n`);
        } catch (e) {}
        
        try {
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const email = clerkUser.emailAddresses[0]?.emailAddress;

          if (email) {
            const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Anonymous';
            user = await User.findOne({ email });

            if (user) {
              user.clerkId = clerkId;
              user.name = name;
              await user.save();
              try {
                fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth synced user by email: ${user.id}\n`);
              } catch (e) {}
            } else {
              user = await User.create({
                clerkId,
                email,
                name,
                role: 'normal',
              });
              try {
                fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth created new user: ${user.id}\n`);
              } catch (e) {}
            }
          }
        } catch (syncErr) {
          logger.error('[OptionalAuth] Sync failed:', syncErr.message);
          try {
            fs.appendFileSync('ownership_debug.log', `[DEBUG] ${new Date().toISOString()} - OptionalAuth sync failed: ${syncErr.message}\n`);
          } catch (e) {}
        }
      }

      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    logger.error('[OptionalAuth] Error:', error.message);
    next();
  }
};

export default optionalAuthMiddleware;
