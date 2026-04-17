import express from 'express';
import { Webhook } from 'svix';
import User from '../models/User.js';
import { loggerService } from '../utils/index.js';

const router = express.Router();
const logger = loggerService.getLogger();

// Clerk webhook requires raw body for verification
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    logger.error('CLERK_WEBHOOK_SECRET is not set');
    return res.status(500).json({ success: false, message: 'Server configuration error' });
  }

  // Get headers
  const svix_id = req.headers['svix-id'];
  const svix_timestamp = req.headers['svix-timestamp'];
  const svix_signature = req.headers['svix-signature'];

  // If there are missing Svix headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({
      success: false,
      message: 'Missing svix headers',
    });
  }

  // Verify payload
  const payload = req.body;
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;

  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    });
  } catch (err) {
    logger.error('Error verifying webhook:', err.message);
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  logger.info(`Received webhook with ID ${id} and event type of ${eventType}`);

  if (eventType === 'user.created') {
    const { email_addresses, first_name, last_name } = evt.data;

    const email = email_addresses[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim() || 'Anonymous';

    try {
      await User.create({
        clerkId: id,
        email,
        name,
        role: 'normal',
      });
      logger.info(`Successfully created user ${id} in DB`);
    } catch (dbError) {
      logger.error('Error saving user to database:', dbError);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  if (eventType === 'user.deleted') {
    try {
      await User.findOneAndDelete({ clerkId: id });
      logger.info(`Successfully deleted user ${id} from DB`);
    } catch (dbError) {
      logger.error('Error deleting user from database:', dbError);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
  }

  return res.status(200).json({ success: true, message: 'Webhook received' });
});

export default router;
