# Upload Module

## Purpose

Handles **file uploads** for user avatars using **Multer**. Uploads are stored on the local filesystem and served statically.

## Location

`src/modules/upload/`

## Structure

```
src/modules/upload/
├── index.js            # Barrel exports
└── upload.routes.js    # Upload route definition
```

## Responsibilities

- Accept file uploads via multipart/form-data
- Validate file types and sizes
- Store files on local filesystem
- Return public URLs for uploaded files

## Public API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/v1/upload/avatar` | Required | Upload avatar image |

## Upload Limits

| Constraint | Value |
|------------|-------|
| Max file size | 5 MB |
| Allowed types | jpg, jpeg, png, webp, gif |

## Storage

- Files stored in `./uploads/` directory (created automatically if missing)
- Filename format: `avatar-<timestamp>-<random>.<ext>`
- Served statically at `/uploads/<filename>`

## Dependencies

| Dependency | Type | Purpose |
|-----------|------|---------|
| Auth module | Internal | Authentication middleware |
| `multer` | External | File upload handling |

## Important Notes

- Only image files are accepted (jpg, jpeg, png, webp, gif)
- Upload directory is created automatically on first request
- File URLs are constructed dynamically using `req.protocol` and `req.get('host')`
