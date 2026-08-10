import { Webhook } from 'svix';
import webhookService from './webhook.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const handleClerkWebhook = async (req, res, next) => {
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

  try {
    if (eventType === 'user.created') {
      await webhookService.createUser(evt.data);
    } else if (eventType === 'user.updated') {
      await webhookService.updateUser(evt.data);
    } else if (eventType === 'user.deleted') {
      await webhookService.deleteUser(evt.data);
    } else if (eventType === 'invitation.created') {
      await webhookService.handleInvitationCreated(evt.data);
    } else if (eventType === 'invitation.accepted') {
      await webhookService.handleInvitationAccepted(evt.data);
    } else if (eventType === 'invitation.revoked') {
      await webhookService.handleInvitationRevoked(evt.data);
    }

    return res.status(200).json({ success: true, message: 'Webhook received' });
  } catch (error) {
    logger.error('Error processing webhook event:', error);
    return res.status(500).json({ success: false, message: 'Database error' });
  }
};

export default { handleClerkWebhook };
