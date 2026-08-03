import { z } from 'zod';

/** Shared by every Developer Platform `POST /:resource/bulk-delete` route. */
export const bulkDeleteSchema = z.object({
  ids: z
    .array(z.string())
    .min(1, 'ids must contain at least one id')
    .max(100, 'ids must not exceed 100 per request'),
});

export default bulkDeleteSchema;
