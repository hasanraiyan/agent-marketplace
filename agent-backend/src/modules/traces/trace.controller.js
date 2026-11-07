import traceService from './trace.service.js';
import fileRepository from '../files/file.repository.js';
import fileService from '../files/file.service.js';
import NotFoundError from '../../utils/errors/NotFoundError.js';
import { paginationEnvelope } from '../../utils/pagination.js';

const MAX_LIMIT = 100;

/**
 * `bytes=start-end` / `bytes=start-` / `bytes=-suffix` → inclusive range,
 * null for no (or a multi-) range, 'invalid' when unsatisfiable.
 */
export function parseRange(header, size) {
  if (!header || typeof header !== 'string') return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  let start;
  let end;
  if (m[1] === '' && m[2] === '') return 'invalid';
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

/**
 * Project Admin trace read endpoints (mounted under
 * /api/v1/projects/{projectId}/traces in project.routes.js, behind
 * projectAdminAuthMiddleware). Read-only; traces are written by
 * agui.service.js via traceService.begin().
 */
class TraceController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit) || 20));
      const { agentId, threadId, status, source, channel, from, to } = req.query;
      const { items, total } = await traceService.list(
        req.projectAdminContext.domain,
        { agentId, threadId, status, source, channel, from, to },
        { page, limit }
      );
      res.json({ success: true, data: paginationEnvelope(items, total, page, limit) });
    } catch (error) {
      next(error);
    }
  }

  async stats(req, res, next) {
    try {
      const data = await traceService.stats(req.projectAdminContext.domain, {
        agentId: req.query.agentId,
        days: req.query.days,
      });
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** Streams a voice call's recording (WAV) with HTTP Range support for seeking. */
  async audio(req, res, next) {
    try {
      const { key, size, mimeType } = await traceService.getAudio(
        req.projectAdminContext.domain,
        req.params.traceId
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'private, max-age=300');
      const range = parseRange(req.headers.range, size);
      if (range === 'invalid') {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }
      if (range) {
        res.status(206);
        res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${size}`);
        res.setHeader('Content-Length', String(range.end - range.start + 1));
      } else {
        res.setHeader('Content-Length', String(size));
      }
      const stream = traceService.openAudioStream(key, range || undefined);
      stream.on('error', (err) => (res.headersSent ? res.destroy(err) : next(err)));
      return stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }

  /** Streams an attachment or image referenced in a trace for this Project domain. */
  async file(req, res, next) {
    try {
      const { fileId } = req.params;
      const domain = req.projectAdminContext.domain;
      const file = await fileRepository.findById(fileId);
      if (!file || file.domain !== domain) {
        throw new NotFoundError('File not found');
      }
      const { stream, contentType, contentLength } = await fileService.getFileReadStream(file);
      res.setHeader('Content-Type', file.mimeType || contentType || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`
      );
      res.setHeader('Cache-Control', 'private, max-age=86400');
      if (contentLength) {
        res.setHeader('Content-Length', String(contentLength));
      }
      stream.on('error', (err) => (res.headersSent ? res.destroy(err) : next(err)));
      return stream.pipe(res);
    } catch (error) {
      return next(error);
    }
  }

  async get(req, res, next) {
    try {
      const data = await traceService.get(req.projectAdminContext.domain, req.params.traceId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new TraceController();
