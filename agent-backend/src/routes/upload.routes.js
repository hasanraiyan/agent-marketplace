import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import authMiddleware from '../middlewares/auth.middleware.js';
import successFormatter from '../utils/formatters/successFormatter.js';
import BaseError from '../utils/errors/BaseError.js';

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
      cb(new BaseError('Only image files (jpg, jpeg, png, webp, gif) are allowed', 400, 'BAD_REQUEST'));
    }
  },
});

// POST /api/v1/upload/avatar
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
