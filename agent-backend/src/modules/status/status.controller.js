import statusService from './status.service.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

const getStatus = (req, res, next) => {
  try {
    res.json(statusService.getStatus());
  } catch (err) {
    logger.error('Status check failed', err);
    next(err);
  }
};

export default { getStatus };
