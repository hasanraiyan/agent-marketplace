import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import authMiddleware from '../auth/auth.middleware.js';
import successFormatter from '../../utils/formatters/successFormatter.js';
import BaseError from '../../utils/errors/BaseError.js';

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

// Configure upload middleware
const upload = multer({
  storage: storage,
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
 *       Uploads a user avatar image. The file is saved to the local filesystem under
 *       the uploads/ directory and served statically at /uploads/{filename}.
 *       Accepted formats: JPEG, PNG, WebP, GIF. Max file size: 5MB.
 *       The avatar URL is returned in the response and can be set on the user profile.
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
router.post('/avatar', authMiddleware, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new BaseError('No file uploaded', 400, 'BAD_REQUEST');
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    res.json(
      successFormatter.formatSuccess(
        {
          url: fileUrl,
          filename: req.file.filename,
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
