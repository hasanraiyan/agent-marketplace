import express from 'express';
import multer from 'multer';
import path from 'path';
import authMiddleware from '../auth/auth.middleware.js';
import successFormatter from '../../utils/formatters/successFormatter.js';
import BaseError from '../../utils/errors/BaseError.js';
import { s3Service } from '../../services/storage/index.js';

const router = express.Router();

// Memory storage — file bytes are streamed directly to S3 without touching local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(
        new BaseError(
          'Only image files (jpg, jpeg, png, webp, gif) are allowed',
          400,
          'BAD_REQUEST'
        )
      );
    }
  },
});

/**
 * @openapi
 * /api/v1/upload/avatar:
 *   post:
 *     tags: [Upload]
 *     summary: Upload an avatar image
 *     description: |
 *       Uploads a user avatar image directly to S3-compatible object storage (MinIO in local dev,
 *       S3 in production) under the public bucket.
 *       Accepted formats: JPEG, PNG, WebP, GIF. Max file size: 5MB.
 *       The public avatar URL is returned in the response and can be set on the user profile.
 *     security: [{ clerkAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image file (jpg, jpeg, png, webp, gif, max 5MB)
 *     responses:
 *       200:
 *         description: File uploaded — returns the public URL
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid file type, no file uploaded, or file too large
 *       401:
 *         description: Unauthorized
 */
router.post('/avatar', authMiddleware, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new BaseError('No file uploaded', 400, 'BAD_REQUEST');
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `avatar-${uniqueSuffix}${ext}`;
    const key = `avatars/${filename}`;

    const uploaded = await s3Service.uploadBuffer({
      bucket: s3Service.publicBucket,
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      isPublic: true,
    });

    res.json(
      successFormatter.formatSuccess(
        {
          url: uploaded.url,
          filename,
          key,
          size: req.file.size,
        },
        'File uploaded successfully'
      )
    );
  } catch (error) {
    next(error);
  }
});

export default router;
