import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '../../config/index.js';
import { loggerService } from '../../utils/index.js';

const logger = loggerService.getLogger();

class S3Service {
  #client = null;
  #bucketsInitialized = false;

  constructor() {
    this.#initClient();
  }

  #initClient() {
    const s3Cfg = config.s3;
    const clientConfig = {
      region: s3Cfg.region,
      credentials: {
        accessKeyId: s3Cfg.accessKeyId,
        secretAccessKey: s3Cfg.secretAccessKey,
      },
      forcePathStyle: s3Cfg.forcePathStyle,
    };

    if (s3Cfg.endpoint) {
      clientConfig.endpoint = s3Cfg.endpoint;
    }

    this.#client = new S3Client(clientConfig);
  }

  get client() {
    return this.#client;
  }

  get publicBucket() {
    return config.s3.publicBucket;
  }

  get privateBucket() {
    return config.s3.privateBucket;
  }

  /**
   * Ensures default public and private buckets exist, configuring public-read
   * access policy for the public bucket if necessary.
   */
  async ensureBuckets() {
    if (this.#bucketsInitialized) return;

    try {
      await this.#ensureBucket(this.publicBucket, true);
      await this.#ensureBucket(this.privateBucket, false);
      this.#bucketsInitialized = true;
      logger.info(
        `[S3Storage] Storage buckets verified: ${this.publicBucket}, ${this.privateBucket}`
      );
    } catch (err) {
      logger.error(`[S3Storage] Error ensuring S3 buckets: ${err.message}`, { error: err });
    }
  }

  async #ensureBucket(bucketName, isPublic = false) {
    try {
      await this.#client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (err) {
      // 404 or NotFound means bucket needs to be created
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        logger.info(`[S3Storage] Creating bucket: ${bucketName}`);
        await this.#client.send(new CreateBucketCommand({ Bucket: bucketName }));

        if (isPublic) {
          await this.#setPublicBucketPolicy(bucketName);
        }
      } else {
        throw err;
      }
    }
  }

  async #setPublicBucketPolicy(bucketName) {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucketName}/*`],
        },
      ],
    };

    try {
      await this.#client.send(
        new PutBucketPolicyCommand({
          Bucket: bucketName,
          Policy: JSON.stringify(policy),
        })
      );
      logger.info(`[S3Storage] Set public read policy for ${bucketName}`);
    } catch (err) {
      logger.warn(`[S3Storage] Could not set bucket policy for ${bucketName}: ${err.message}`);
    }
  }

  /**
   * Upload a Buffer to S3/MinIO.
   *
   * @param {Object} options
   * @param {string} options.bucket - Target bucket name (default: privateBucket)
   * @param {string} options.key - Object key (filename/path in bucket)
   * @param {Buffer|Uint8Array} options.buffer - Raw file bytes
   * @param {string} [options.contentType] - MIME type
   * @param {boolean} [options.isPublic] - Whether this object is in the public bucket
   * @returns {Promise<{ key: string, bucket: string, url: string, etag: string }>}
   */
  async uploadBuffer({
    bucket = this.privateBucket,
    key,
    buffer,
    contentType = 'application/octet-stream',
    isPublic = false,
  }) {
    const targetBucket = isPublic ? this.publicBucket : bucket;

    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    const response = await this.#client.send(command);
    const url = targetBucket === this.publicBucket ? this.getPublicUrl(key) : null;

    return {
      key,
      bucket: targetBucket,
      url,
      etag: response.ETag,
    };
  }

  /**
   * Retrieves an object as a Buffer.
   *
   * @param {Object} options
   * @param {string} [options.bucket] - Bucket name (default: privateBucket)
   * @param {string} options.key - Object key
   * @returns {Promise<Buffer>}
   */
  async getBuffer({ bucket = this.privateBucket, key }) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await this.#client.send(command);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  /**
   * Returns a readable stream for the object, supporting HTTP Range requests.
   *
   * @param {Object} options
   * @param {string} [options.bucket] - Bucket name (default: privateBucket)
   * @param {string} options.key - Object key
   * @param {string} [options.range] - Standard HTTP Range header (e.g. "bytes=0-1023")
   * @returns {Promise<{ stream: import('stream').Readable, contentType: string, contentLength: number, contentRange: string, statusCode: number }>}
   */
  async getReadStream({ bucket = this.privateBucket, key, range }) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      Range: range || undefined,
    });

    const response = await this.#client.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      statusCode: range && response.ContentRange ? 206 : 200,
    };
  }

  /**
   * Generates a time-limited signed download URL.
   *
   * @param {Object} options
   * @param {string} [options.bucket] - Bucket name (default: privateBucket)
   * @param {string} options.key - Object key
   * @param {number} [options.expiresInSeconds=3600] - Expiry in seconds
   * @param {string} [options.filename] - Optional download filename for Content-Disposition
   * @returns {Promise<string>}
   */
  async getSignedDownloadUrl({
    bucket = this.privateBucket,
    key,
    expiresInSeconds = 3600,
    filename,
  }) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: filename
        ? `attachment; filename="${encodeURIComponent(filename)}"`
        : undefined,
    });

    return await getSignedUrl(this.#client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * An object's metadata without downloading it (HEAD request).
   *
   * @returns {Promise<null | { contentLength: number, contentType: string, lastModified: Date }>}
   *   null when the object does not exist.
   */
  async headObject({ bucket = this.privateBucket, key }) {
    try {
      const response = await this.#client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        contentLength: response.ContentLength,
        contentType: response.ContentType,
        lastModified: response.LastModified,
      };
    } catch (err) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null;
      throw err;
    }
  }

  /**
   * Lists every object under a prefix, page by page.
   *
   * @returns {AsyncGenerator<{ key: string, size: number, lastModified: Date }>}
   */
  async *listObjects({ bucket = this.privateBucket, prefix }) {
    let ContinuationToken;
    do {
      const page = await this.#client.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken })
      );
      for (const obj of page.Contents || []) {
        yield { key: obj.Key, size: obj.Size, lastModified: obj.LastModified };
      }
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
  }

  /**
   * Deletes a single object.
   */
  async deleteObject({ bucket = this.privateBucket, key }) {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await this.#client.send(command);
  }

  /**
   * Batch deletes multiple objects.
   */
  async deleteObjects({ bucket = this.privateBucket, keys }) {
    if (!keys || keys.length === 0) return { deleted: 0 };

    const objects = keys.map((k) => ({ Key: k }));
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: objects, Quiet: true },
    });
    const result = await this.#client.send(command);
    return { deleted: (result.Deleted || []).length };
  }

  /**
   * Returns the publicly accessible URL for an object in the public bucket.
   */
  getPublicUrl(key) {
    const s3Cfg = config.s3;
    const cleanKey = String(key).replace(/^\/+/, '');

    if (s3Cfg.publicBaseUrl) {
      return `${s3Cfg.publicBaseUrl.replace(/\/+$/, '')}/${cleanKey}`;
    }

    if (s3Cfg.endpoint) {
      return `${s3Cfg.endpoint.replace(/\/+$/, '')}/${this.publicBucket}/${cleanKey}`;
    }

    return `https://${this.publicBucket}.s3.${s3Cfg.region}.amazonaws.com/${cleanKey}`;
  }
}

export default new S3Service();
