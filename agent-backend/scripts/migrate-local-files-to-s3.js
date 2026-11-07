#!/usr/bin/env node

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { s3Service } from '../src/services/storage/index.js';
import { loggerService } from '../src/utils/index.js';

const logger = loggerService.getLogger();

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const deleteLocal = args.includes('--delete-local');

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.wav': 'audio/wav',
  '.pcm': 'audio/pcm',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

async function migrateFolder({ dirPath, bucket, prefix, isPublic = false, filter = () => true }) {
  if (!fs.existsSync(dirPath)) {
    return { scanned: 0, uploaded: 0, failed: 0, bytes: 0 };
  }

  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && filter(e.name));

  let uploaded = 0;
  let failed = 0;
  let totalBytes = 0;

  for (const file of files) {
    const fullPath = path.join(dirPath, file.name);
    const key = prefix ? `${prefix.replace(/\/+$/, '')}/${file.name}` : file.name;

    try {
      const stat = await fsp.stat(fullPath);
      totalBytes += stat.size;

      if (isDryRun) {
        logger.info(`[DryRun] Would upload: ${fullPath} → s3://${bucket}/${key} (${stat.size} bytes)`);
        uploaded++;
        continue;
      }

      const buffer = await fsp.readFile(fullPath);
      const contentType = getMime(file.name);

      await s3Service.uploadBuffer({
        bucket,
        key,
        buffer,
        contentType,
        isPublic,
      });

      logger.info(`[Migrated] ${file.name} → s3://${bucket}/${key} (${stat.size} bytes)`);
      uploaded++;

      if (deleteLocal) {
        await fsp.unlink(fullPath);
        logger.info(`[DeletedLocal] ${fullPath}`);
      }
    } catch (err) {
      logger.error(`[Failed] ${fullPath}: ${err.message}`);
      failed++;
    }
  }

  return { scanned: files.length, uploaded, failed, bytes: totalBytes };
}

async function main() {
  console.log('====================================================');
  console.log('       Local Drive to S3 Migration Utility          ');
  console.log('====================================================');
  if (isDryRun) console.log('MODE: DRY RUN (no files will be uploaded or deleted)');
  if (deleteLocal) console.log('WARNING: --delete-local active. Migrated local files will be removed.');

  await s3Service.ensureBuckets();

  const cwd = process.cwd();
  const uploadsDir = path.join(cwd, 'uploads');
  const developerUploadsDir = path.join(cwd, 'developer-uploads');
  const traceAudioDir = path.join(cwd, 'trace-audio');

  console.log('\n--- 1. Migrating Public Avatars & Uploads ---');
  const uploadsStats = await migrateFolder({
    dirPath: uploadsDir,
    bucket: s3Service.publicBucket,
    prefix: 'avatars',
    isPublic: true,
  });

  console.log('\n--- 2. Migrating Developer Platform Files ---');
  const devStats = await migrateFolder({
    dirPath: developerUploadsDir,
    bucket: s3Service.privateBucket,
    prefix: 'files',
    isPublic: false,
  });

  console.log('\n--- 3. Migrating Voice Call Traces (.wav) ---');
  const traceStats = await migrateFolder({
    dirPath: traceAudioDir,
    bucket: s3Service.privateBucket,
    prefix: 'traces/voice',
    isPublic: false,
    filter: (name) => name.endsWith('.wav'),
  });

  console.log('\n====================================================');
  console.log('Migration Summary:');
  console.log(`Public Avatars:   ${uploadsStats.uploaded}/${uploadsStats.scanned} uploaded (${uploadsStats.bytes} bytes)`);
  console.log(`Developer Files:  ${devStats.uploaded}/${devStats.scanned} uploaded (${devStats.bytes} bytes)`);
  console.log(`Voice Traces:     ${traceStats.uploaded}/${traceStats.scanned} uploaded (${traceStats.bytes} bytes)`);
  console.log('====================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
