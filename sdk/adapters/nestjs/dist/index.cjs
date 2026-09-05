'use strict';

var common = require('@nestjs/common');
var sdk = require('@personaai/sdk');
var stream = require('stream');
var runtime = require('@personaai/runtime');

var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (decorator(result)) || result;
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);

// src/constants.ts
var PERSONA_MODULE_OPTIONS = /* @__PURE__ */ Symbol("PERSONA_MODULE_OPTIONS");
var PERSONA_RUNTIME = /* @__PURE__ */ Symbol("PERSONA_RUNTIME");
var PERSONA_CLIENT = /* @__PURE__ */ Symbol("PERSONA_CLIENT");
exports.PersonaService = class PersonaService {
  constructor(options, runtime, client) {
    this.options = options;
    this.runtime = runtime;
    this.client = client;
    this.logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
    this.log = this.logger.child("service");
    this.log.debug("PersonaService constructed", {
      hasBaseUrl: !!options.baseUrl,
      hasRuntime: !!runtime,
      hasClient: !!client
    });
    this.log.trace("PersonaService config", {
      hasCredential: !!options.credential,
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
      routePrefix: options.routePrefix ?? "/api/persona"
    });
    this.log.info("PersonaService ready", {});
  }
  options;
  runtime;
  client;
  logger;
  log;
  /**
   * Constructs a PersonaClient scoped to a specific end-user.
   * Use this to create threads, run AG-UI streaming chats, or manage user files.
   */
  forUser(externalUserId) {
    this.log.debug("forUser called", { hasExternalUserId: !!externalUserId });
    this.log.trace("forUser details", {
      externalUserIdLength: externalUserId?.length ?? 0
    });
    this.log.info("creating scoped client", {
      hasExternalUserId: !!externalUserId
    });
    const scoped = new sdk.PersonaClient({
      baseUrl: this.options.baseUrl,
      credential: this.options.credential,
      externalUserId,
      fetch: this.options.fetch
    });
    this.log.debug("scoped client created", {
      hasExternalUserId: !!externalUserId
    });
    return scoped;
  }
  async onModuleDestroy() {
    this.log.debug("onModuleDestroy start", {});
    this.log.info("shutting down runtime", {});
    if (typeof this.runtime.close === "function") {
      try {
        await this.runtime.close();
        this.log.debug("runtime closed", {});
        this.log.info("runtime shutdown complete", {});
      } catch (err) {
        this.log.error("runtime close failed", {
          error: err instanceof Error ? err.message : String(err)
        });
        this.log.warn("runtime shutdown error", {
          error: err instanceof Error ? err.message : String(err)
        });
        throw err;
      }
    } else {
      this.log.warn("runtime close not available", {});
      this.log.trace("runtime has no close method", {});
    }
    this.log.debug("onModuleDestroy complete", {});
  }
};
exports.PersonaService = __decorateClass([
  common.Injectable(),
  __decorateParam(0, common.Inject(PERSONA_MODULE_OPTIONS)),
  __decorateParam(1, common.Inject(PERSONA_RUNTIME)),
  __decorateParam(2, common.Inject(PERSONA_CLIENT))
], exports.PersonaService);
function toUploadedFile(file) {
  return {
    filename: file.originalname,
    content: new Uint8Array(file.buffer),
    contentType: file.mimetype || void 0
  };
}
function collectMulterFiles(req, logger) {
  const log = logger?.child("multipart");
  const multerReq = req;
  const file = multerReq.file;
  const files = multerReq.files;
  const hasFile = !!file;
  const rawFiles = files;
  log?.trace("collectMulterFiles check", { hasFile, hasFiles: !!rawFiles });
  if (!file && !files) {
    log?.trace("collectMulterFiles \u2014 no host-parsed files");
    return null;
  }
  const mappedFile = file ? toUploadedFile(file) : void 0;
  const array = Array.isArray(files) ? files : files ? Object.values(files).flat() : [];
  const result = {
    file: mappedFile,
    files: array.length > 0 ? array.map(toUploadedFile) : void 0
  };
  log?.debug("collectMulterFiles mapped", {
    hasFile: !!mappedFile,
    fileName: mappedFile?.filename,
    fileCount: result.files?.length ?? 0
  });
  log?.info("collected multer files", {
    hasFile: !!mappedFile,
    fileCount: result.files?.length ?? 0
  });
  if (result.files) {
    for (const f of result.files) {
      log?.trace("multer file", {
        filename: f.filename,
        size: f.content.length
      });
    }
  }
  if (mappedFile) {
    log?.trace("multer file", {
      filename: mappedFile.filename,
      size: mappedFile.content.length
    });
  }
  return result;
}
async function parseMultipart(req, contentType, logger) {
  const log = logger?.child("multipart");
  log?.debug("parseMultipart start", {
    contentType: contentType ? "[present]" : "[missing]"
  });
  log?.trace("parseMultipart content-type header", {
    headerLength: contentType.length
  });
  log?.info("multipart native parse start", {});
  const request = new Request("http://internal/", {
    method: "POST",
    headers: { "content-type": contentType },
    body: stream.Readable.toWeb(req),
    duplex: "half"
  });
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    log?.error("parseMultipart formData failed", {
      error: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }
  let file;
  const files = [];
  const fields = /* @__PURE__ */ Object.create(null);
  let fieldCount = 0;
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const uploaded = {
        filename: value.name,
        content: new Uint8Array(await value.arrayBuffer()),
        contentType: value.type || void 0
      };
      if (key === "file") {
        file = uploaded;
        log?.debug("parseMultipart found file field", {
          filename: uploaded.filename,
          size: uploaded.content.length
        });
        log?.trace("multipart file details", {
          field: key,
          filename: uploaded.filename,
          contentType: uploaded.contentType,
          size: uploaded.content.length
        });
      } else if (key === "files") {
        files.push(uploaded);
        log?.debug("parseMultipart found files field", {
          filename: uploaded.filename,
          size: uploaded.content.length,
          totalFiles: files.length
        });
        log?.trace("multipart files details", {
          field: key,
          filename: uploaded.filename,
          contentType: uploaded.contentType,
          size: uploaded.content.length
        });
      } else {
        log?.warn("parseMultipart unexpected file field", {
          field: key,
          filename: uploaded.filename
        });
        log?.trace("multipart unexpected file", {
          field: key,
          filename: uploaded.filename,
          size: uploaded.content.length
        });
      }
    } else {
      fields[key] = value;
      fieldCount++;
      log?.trace("multipart field", {
        field: key,
        valueLength: String(value).length
      });
    }
  }
  log?.debug("parseMultipart completed", {
    hasFile: !!file,
    fileCount: files.length,
    fieldCount
  });
  log?.info("multipart parsed", {
    hasFile: !!file,
    fileCount: files.length,
    fieldCount
  });
  if (files.length === 0 && !file) {
    log?.warn("parseMultipart no files found", { fieldCount });
  }
  return { file, files: files.length > 0 ? files : void 0, body: fields };
}

// src/translate.ts
var TranslationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "TranslationError";
  }
};
function redactHeaders(headers) {
  const redacted = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === void 0) continue;
    if (k.toLowerCase() === "authorization") redacted[k] = "***";
    else redacted[k] = v;
  }
  return redacted;
}
async function readJsonBody(req, logger) {
  const log = logger?.child("translate");
  log?.trace("readJsonBody start", { readableEnded: req.readableEnded });
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) {
    log?.trace("readJsonBody empty stream");
    return void 0;
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length === 0) {
    log?.trace("readJsonBody empty text");
    return void 0;
  }
  log?.debug("readJsonBody raw text length", { length: text.length });
  try {
    const parsed = JSON.parse(text);
    log?.trace("readJsonBody parsed", {
      keys: parsed && typeof parsed === "object" ? Object.keys(parsed) : void 0
    });
    return parsed;
  } catch (err) {
    log?.error("readJsonBody invalid JSON", {
      error: err instanceof Error ? err.message : String(err)
    });
    throw new TranslationError("Request body is not valid JSON.");
  }
}
async function toRuntimeRequest(req, logger) {
  const log = logger?.child("translate");
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.originalUrl || req.url, "http://localhost");
  const query = {};
  for (const [key, value] of url.searchParams) query[key] = value;
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  log?.debug("translate start", {
    method,
    path: req.path || url.pathname,
    originalUrl: req.originalUrl || req.url
  });
  log?.trace("translate headers", { headers: redactHeaders(headers) });
  log?.trace("translate query", {
    query,
    hasQuery: Object.keys(query).length > 0
  });
  log?.trace("translate path details", {
    path: req.path || url.pathname,
    originalUrl: req.originalUrl || req.url,
    hasOriginalUrl: !!(req.originalUrl || req.url)
  });
  const bodyless = method === "GET" || method === "DELETE";
  const contentTypeHeader = headers["content-type"] ?? "";
  const contentType = contentTypeHeader.toLowerCase();
  log?.debug("translate content-type", {
    contentTypeHeader: contentTypeHeader ? "[present]" : "[none]",
    isMultipart: contentType.includes("multipart/form-data"),
    bodyless
  });
  let body;
  let file;
  let files;
  if (!bodyless && contentType.includes("multipart/form-data")) {
    log?.info("multipart request detected", {
      path: req.path || url.pathname,
      method
    });
    const parsedByHost = collectMulterFiles(req, logger);
    if (parsedByHost) {
      file = parsedByHost.file;
      files = parsedByHost.files;
      body = req.body;
      log?.info("multipart via host parser (multer)", {
        hasFile: !!file,
        fileCount: files?.length ?? 0,
        hasBody: body !== void 0
      });
      log?.debug("multipart host-parsed details", {
        fileName: file?.filename,
        fileCount: files?.length ?? 0
      });
    } else if (req.readableEnded) {
      log?.warn("multipart body already consumed", {
        path: req.path || url.pathname,
        readableEnded: req.readableEnded
      });
      log?.error("multipart translation failed \u2014 stream consumed", {
        path: req.path || url.pathname
      });
      throw new TranslationError(
        "Multipart request body was consumed by a body parser before the Persona adapter could read it. Mount the adapter before any multipart body parser, or remove the parser."
      );
    } else {
      log?.debug("parsing multipart natively", {
        path: req.path || url.pathname
      });
      try {
        const parsed = await parseMultipart(req, contentTypeHeader, logger);
        file = parsed.file;
        files = parsed.files;
        body = parsed.body;
        log?.info("multipart parsed natively", {
          hasFile: !!file,
          fileCount: files?.length ?? 0,
          fieldCount: Object.keys(parsed.body).length
        });
        log?.debug("multipart native details", {
          fileName: file?.filename,
          fileCount: files?.length ?? 0
        });
        log?.trace("multipart fields", { fields: Object.keys(parsed.body) });
      } catch (err) {
        if (err instanceof TranslationError) {
          log?.error("multipart TranslationError", {
            error: err.message,
            path: req.path || url.pathname
          });
          throw err;
        }
        log?.error("multipart parse failed", {
          error: err instanceof Error ? err.message : String(err),
          path: req.path || url.pathname
        });
        throw new TranslationError(
          `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } else if (!bodyless) {
    const hasHostBody = req.body !== void 0;
    log?.debug("json body handling", {
      hasHostBody,
      path: req.path || url.pathname
    });
    if (hasHostBody) {
      log?.trace("using host-parsed body", {
        bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body) : void 0,
        hasBody: true
      });
    } else {
      log?.trace("reading raw json stream", { path: req.path || url.pathname });
    }
    try {
      body = req.body ?? await readJsonBody(req, logger);
      log?.debug("json body resolved", {
        hasBody: body !== void 0,
        path: req.path || url.pathname
      });
      if (body !== void 0) {
        log?.trace("json body keys", {
          keys: body && typeof body === "object" ? Object.keys(body) : typeof body
        });
      }
    } catch (err) {
      if (err instanceof TranslationError) {
        log?.warn("json body translation failed", {
          error: err.message,
          path: req.path || url.pathname
        });
        throw err;
      }
      log?.error("json body unexpected error", {
        error: err instanceof Error ? err.message : String(err)
      });
      throw err;
    }
  } else {
    log?.debug("bodyless request \u2014 skipping body parse", {
      method,
      path: req.path || url.pathname
    });
  }
  const result = {
    method,
    path: req.path || url.pathname,
    headers,
    query,
    body,
    file,
    files,
    userId: null
  };
  log?.info("translate complete", {
    method,
    path: req.path || url.pathname,
    hasBody: body !== void 0,
    hasFile: !!file,
    fileCount: files?.length ?? 0
  });
  log?.trace("translate result", {
    method,
    path: req.path || url.pathname,
    queryKeys: Object.keys(query),
    hasFile: !!file,
    fileCount: files?.length ?? 0
  });
  return result;
}

// src/write.ts
function waitForDrainOrClose(res, logger) {
  const log = logger?.child("write");
  return new Promise((resolve) => {
    const cleanup = () => {
      res.off("drain", onDrain);
      res.off("close", onClose);
    };
    const onDrain = () => {
      log?.debug("write drain", {});
      log?.trace("write drain event", {});
      cleanup();
      resolve();
    };
    const onClose = () => {
      log?.warn("write close while waiting for drain", {});
      log?.trace("write close event during drain wait", {});
      cleanup();
      resolve();
    };
    res.once("drain", onDrain);
    res.once("close", onClose);
  });
}
async function writeRuntimeResponse(res, response, logger) {
  const log = logger?.child("write");
  const kind = response.kind;
  const status = response.status;
  log?.debug("write start", { kind, status });
  log?.trace("write headers", { headers: response.headers, status, kind });
  log?.info("response write start", { kind, status });
  res.status(response.status);
  for (const [key, value] of Object.entries(response.headers)) {
    res.set ? res.set(key, value) : res.setHeader?.(key, value);
  }
  log?.trace("write headers set", {
    headerCount: Object.keys(response.headers).length
  });
  if (response.kind === "buffered") {
    const bodyLength = response.body.length;
    log?.debug("write buffered", { status, bodyLength });
    log?.info("write buffered complete", { status, bodyLength });
    log?.trace("write buffered body preview", {
      preview: response.body.slice(0, 200),
      length: bodyLength
    });
    res.end(response.body);
    log?.debug("write buffered ended", { status });
    return;
  }
  log?.info("write streaming start", { kind, status });
  log?.debug("flush headers", { kind, status });
  if (typeof res.setHeader === "function") {
    res.setHeader("X-Accel-Buffering", "no");
  }
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  log?.trace("headers flushed", { kind });
  const body = response.body;
  const iterator = body[Symbol.asyncIterator]();
  const iterable = {
    [Symbol.asyncIterator]: () => iterator
  };
  let closed = false;
  let chunkCount = 0;
  let bytesWritten = 0;
  const onClose = () => {
    closed = true;
    log?.warn("client disconnect \u2014 aborting stream", {
      kind,
      chunkCount,
      bytesWritten
    });
    log?.info("stream aborted by client", { kind, chunkCount });
    const returned = iterator.return?.();
    if (returned) void returned.catch(() => {
    });
    log?.trace("iterator.return called", { kind });
  };
  res.on("close", onClose);
  log?.trace("close listener attached", { kind });
  try {
    for await (const chunk of iterable) {
      if (closed) {
        log?.debug("stream closed mid-iteration \u2014 breaking", { chunkCount });
        break;
      }
      chunkCount++;
      const isString = typeof chunk === "string";
      const len = isString ? chunk.length : chunk.length;
      bytesWritten += len;
      log?.trace("write chunk", { kind, chunkCount, length: len, isString });
      if (chunkCount === 1) {
        log?.debug("first chunk", { kind, length: len });
      }
      const canContinue = res.write(chunk);
      log?.trace("write result", { canContinue, chunkCount, length: len });
      if (typeof res.flush === "function") {
        res.flush();
      }
      if (!canContinue) {
        log?.debug("write backpressure \u2014 waiting for drain", {
          chunkCount,
          bytesWritten
        });
        log?.info("backpressure detected", { chunkCount });
        await waitForDrainOrClose(res, logger);
        if (closed) {
          log?.warn("stream closed during backpressure wait", { chunkCount });
          break;
        }
        log?.debug("drain resolved \u2014 resuming", { chunkCount });
      }
    }
    if (!closed) {
      log?.info("stream completed", { kind, chunkCount, bytesWritten });
      log?.debug("ending response", { kind, chunkCount });
      res.end();
      log?.trace("response ended", { kind });
    } else {
      log?.debug("stream already closed \u2014 skipping end", { kind });
    }
  } catch (err) {
    log?.error("stream write failed", {
      kind,
      error: err instanceof Error ? err.message : String(err),
      chunkCount
    });
    if (!res.headersSent) {
      log?.warn("stream error before headers \u2014 cannot send error body", {
        kind
      });
    }
    if (!res.writableEnded) {
      try {
        res.end();
      } catch {
      }
    }
    throw err;
  } finally {
    res.off("close", onClose);
    log?.trace("close listener detached", { kind, chunkCount });
    log?.debug("write finished", {
      kind,
      status,
      chunkCount,
      bytesWritten,
      closed
    });
  }
}

// src/persona.middleware.ts
exports.PersonaMiddleware = class PersonaMiddleware {
  constructor(options, runtime) {
    this.options = options;
    this.runtime = runtime;
    this.logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
    this.log = this.logger.child("middleware");
    this.log.debug("PersonaMiddleware constructed", {
      hasRuntime: !!runtime,
      hasResolveUserFrom: !!options.resolveUserFrom,
      routePrefix: options.routePrefix ?? "/api/persona"
    });
    this.log.trace("PersonaMiddleware config", {
      hasBaseUrl: !!options.baseUrl,
      hasLogger: !!options.logger,
      hasLogLevel: !!options.logLevel
    });
    this.log.info("PersonaMiddleware ready", {
      routePrefix: options.routePrefix ?? "/api/persona"
    });
  }
  options;
  runtime;
  logger;
  log;
  async use(req, res, next) {
    const startMs = Date.now();
    const method = req.method ?? "GET";
    const path = req.path || req.url;
    this.log.info("request received", { method, path });
    this.log.debug("request start", {
      method,
      path,
      originalUrl: req.originalUrl || req.url
    });
    this.log.trace("request details", {
      method,
      path,
      originalUrl: req.originalUrl || req.url,
      headers: (() => {
        const h = {};
        for (const [k, v] of Object.entries(req.headers || {})) {
          if (v === void 0) continue;
          const val = Array.isArray(v) ? v.join(", ") : v;
          h[k] = k.toLowerCase() === "authorization" ? "***" : val;
        }
        return h;
      })()
    });
    try {
      const request = await toRuntimeRequest(req, this.logger);
      if (this.options.resolveUserFrom) {
        this.log.debug("resolving user via resolveUserFrom", {
          path: request.path
        });
        this.log.trace("resolveUserFrom start", { path: request.path });
        try {
          request.userId = await this.options.resolveUserFrom(req);
          this.log.debug("resolveUserFrom result", {
            hasUserId: !!request.userId,
            path: request.path
          });
          this.log.trace("resolveUserFrom completed", {
            hasUserId: !!request.userId
          });
          if (request.userId) {
            this.log.info("user resolved", { path: request.path });
          } else {
            this.log.warn("resolveUserFrom returned null \u2014 will be 401", {
              path: request.path
            });
          }
        } catch (err) {
          this.log.warn("resolveUserFrom threw \u2014 treating as unauthenticated", {
            path: request.path,
            error: err instanceof Error ? err.message : String(err)
          });
          this.log.trace("resolveUserFrom throw details", { error: err });
          request.userId = null;
        }
      } else {
        this.log.trace("no resolveUserFrom \u2014 deferring to runtime resolveUser", {
          path: request.path
        });
      }
      this.log.debug("calling runtime.handle", {
        method: request.method,
        path: request.path
      });
      const response = await this.runtime.handle(request);
      const durationMs = Date.now() - startMs;
      this.log.debug("runtime handled", {
        status: response.status,
        kind: response.kind,
        durationMs,
        path: request.path
      });
      this.log.info("runtime response", {
        status: response.status,
        kind: response.kind,
        durationMs
      });
      this.log.trace("runtime response details", {
        status: response.status,
        kind: response.kind,
        headers: response.headers
      });
      await writeRuntimeResponse(res, response, this.logger);
      const totalMs = Date.now() - startMs;
      this.log.info("request completed", {
        method,
        path,
        status: response.status,
        kind: response.kind,
        durationMs: totalMs
      });
      this.log.debug("request finished", {
        method,
        path,
        status: response.status,
        durationMs: totalMs
      });
    } catch (err) {
      const durationMs = Date.now() - startMs;
      if (res.headersSent) {
        this.log.warn("headers already sent \u2014 cannot send error response", {
          path: req.path,
          durationMs
        });
        this.log.trace("headersSent true details", {
          writableEnded: res.writableEnded
        });
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        this.log.warn("translation error", {
          path: req.path,
          error: err.message,
          durationMs
        });
        this.log.debug("translation error details", { error: err.message });
        res.status(400).json({ error: { code: "INVALID_REQUEST", message: err.message } });
        this.log.info("sent 400 translation error", {
          path: req.path,
          durationMs
        });
        return;
      }
      this.log.error("unhandled adapter error", {
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
        durationMs
      });
      this.log.trace("adapter error stack", {
        error: err instanceof Error ? err.stack : String(err)
      });
      next(err);
    }
  }
};
exports.PersonaMiddleware = __decorateClass([
  common.Injectable(),
  __decorateParam(0, common.Inject(PERSONA_MODULE_OPTIONS)),
  __decorateParam(1, common.Inject(PERSONA_RUNTIME))
], exports.PersonaMiddleware);
exports.PersonaModule = class PersonaModule {
  constructor(options) {
    this.options = options;
    this.logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
    this.log = this.logger.child("module");
    this.log.debug("PersonaModule constructed", {
      routePrefix: options.routePrefix ?? "/api/persona",
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom
    });
    this.log.trace("PersonaModule config", {
      hasBaseUrl: !!options.baseUrl,
      hasLogger: !!options.logger,
      hasLogLevel: !!options.logLevel,
      mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona"
    });
  }
  options;
  logger;
  log;
  static forRoot(options) {
    const logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
    const log = logger.child("module");
    log.debug("PersonaModule.forRoot init", {
      hasBaseUrl: !!options.baseUrl,
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
      mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona",
      routePrefix: options.routePrefix ?? "/api/persona"
    });
    log.trace("PersonaModule.forRoot config", {
      hasHooks: !!options.hooks,
      capabilities: options.capabilities,
      hasLogLevel: !!options.logLevel,
      hasLogger: !!options.logger,
      hasFetch: !!options.fetch
    });
    if (!options.resolveUser && !options.resolveUserFrom) {
      log.error("PersonaModule.forRoot missing resolver", {});
      log.warn("neither resolveUser nor resolveUserFrom provided", {});
      throw new Error(
        'PersonaModule.forRoot: either "resolveUser" or "resolveUserFrom" is required'
      );
    }
    if (options.resolveUser && options.resolveUserFrom) {
      log.warn("both resolveUser and resolveUserFrom provided \u2014 resolveUserFrom will win", {});
    }
    log.info("PersonaModule.forRoot creating providers", {
      hasResolveUserFrom: !!options.resolveUserFrom,
      mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona"
    });
    const optionsProvider = {
      provide: PERSONA_MODULE_OPTIONS,
      useValue: options
    };
    const runtimeProvider = {
      provide: PERSONA_RUNTIME,
      useFactory: () => {
        log.debug("runtimeProvider factory start", {
          hasResolveUserFrom: !!options.resolveUserFrom
        });
        log.trace("runtimeProvider config", {
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona",
          hasLogLevel: !!options.logLevel,
          hasLogger: !!options.logger
        });
        const runtime$1 = runtime.createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona",
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser
        });
        log.debug("runtime created", {
          hasResolveUserFrom: !!options.resolveUserFrom
        });
        log.info("runtime created for forRoot", {
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona"
        });
        log.trace("runtime details", {});
        return runtime$1;
      }
    };
    const clientProvider = {
      provide: PERSONA_CLIENT,
      useFactory: () => {
        log.debug("clientProvider factory start", {
          hasBaseUrl: !!options.baseUrl
        });
        log.trace("clientProvider config", { hasFetch: !!options.fetch });
        const loggerForClient = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
        const clientLogger = loggerForClient.child("client");
        clientLogger.debug("creating PersonaClient", {
          hasBaseUrl: !!options.baseUrl
        });
        const client = new sdk.PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...options.logLevel !== void 0 ? { logLevel: options.logLevel } : {},
          ...options.logger ? { logger: options.logger } : {}
        });
        log.debug("PersonaClient created", { hasBaseUrl: !!options.baseUrl });
        log.info("client created for forRoot", {});
        return client;
      }
    };
    log.info("PersonaModule.forRoot providers ready", {});
    log.debug("PersonaModule.forRoot ready", {});
    return {
      module: exports.PersonaModule,
      providers: [
        optionsProvider,
        runtimeProvider,
        clientProvider,
        exports.PersonaService,
        exports.PersonaMiddleware
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        exports.PersonaService,
        exports.PersonaMiddleware
      ]
    };
  }
  static forRootAsync(asyncOptions) {
    const staticLogger = sdk.createLogger("adapter:nestjs", {});
    const staticLog = staticLogger.child("module");
    staticLog.debug("PersonaModule.forRootAsync init", {
      hasUseFactory: !!asyncOptions.useFactory,
      hasUseClass: !!asyncOptions.useClass,
      hasUseExisting: !!asyncOptions.useExisting,
      hasImports: !!(asyncOptions.imports && asyncOptions.imports.length)
    });
    staticLog.trace("PersonaModule.forRootAsync config", {
      injectCount: asyncOptions.inject?.length ?? 0
    });
    const asyncProviders = this.createAsyncProviders(asyncOptions);
    const runtimeProvider = {
      provide: PERSONA_RUNTIME,
      useFactory: (options) => {
        const logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
        const log = logger.child("module");
        log.debug("forRootAsync runtimeProvider factory start", {
          hasBaseUrl: !!options.baseUrl,
          hasResolveUser: !!options.resolveUser,
          hasResolveUserFrom: !!options.resolveUserFrom
        });
        log.trace("forRootAsync runtimeProvider config", {
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona",
          hasLogLevel: !!options.logLevel,
          hasLogger: !!options.logger
        });
        if (!options.resolveUser && !options.resolveUserFrom) {
          log.error("PersonaModule.forRootAsync missing resolver", {});
          log.warn("neither resolveUser nor resolveUserFrom provided (async)", {});
          throw new Error(
            'PersonaModule.forRootAsync: either "resolveUser" or "resolveUserFrom" is required'
          );
        }
        if (options.resolveUser && options.resolveUserFrom) {
          log.warn(
            "both resolveUser and resolveUserFrom provided \u2014 resolveUserFrom will win (async)",
            {}
          );
        }
        log.info("creating runtime (async)", {
          hasResolveUserFrom: !!options.resolveUserFrom,
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona"
        });
        const runtime$1 = runtime.createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? "/api/persona",
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser
        });
        log.debug("runtime created (async)", {
          hasResolveUserFrom: !!options.resolveUserFrom
        });
        log.info("runtime created for forRootAsync", {});
        return runtime$1;
      },
      inject: [PERSONA_MODULE_OPTIONS]
    };
    const clientProvider = {
      provide: PERSONA_CLIENT,
      useFactory: (options) => {
        const logger = options.logger ?? sdk.createLogger("adapter:nestjs", { level: options.logLevel });
        const log = logger.child("module");
        log.debug("forRootAsync clientProvider factory start", {
          hasBaseUrl: !!options.baseUrl
        });
        log.trace("clientProvider async config", { hasFetch: !!options.fetch });
        const client = new sdk.PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...options.logLevel !== void 0 ? { logLevel: options.logLevel } : {},
          ...options.logger ? { logger: options.logger } : {}
        });
        log.debug("PersonaClient created (async)", {
          hasBaseUrl: !!options.baseUrl
        });
        log.info("client created for forRootAsync", {});
        return client;
      },
      inject: [PERSONA_MODULE_OPTIONS]
    };
    staticLog.info("PersonaModule.forRootAsync providers ready", {});
    staticLog.debug("PersonaModule.forRootAsync ready", {});
    return {
      module: exports.PersonaModule,
      imports: asyncOptions.imports || [],
      providers: [
        ...asyncProviders,
        runtimeProvider,
        clientProvider,
        exports.PersonaService,
        exports.PersonaMiddleware
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        exports.PersonaService,
        exports.PersonaMiddleware
      ]
    };
  }
  static createAsyncProviders(options) {
    const log = sdk.createLogger("adapter:nestjs", {}).child("module");
    log.debug("createAsyncProviders start", {
      hasUseFactory: !!options.useFactory,
      hasUseClass: !!options.useClass,
      hasUseExisting: !!options.useExisting
    });
    log.trace("createAsyncProviders details", {
      hasImports: !!(options.imports && options.imports.length),
      injectCount: options.inject?.length ?? 0
    });
    if (options.useFactory) {
      log.info("using useFactory for async options", {});
      log.debug("createAsyncProviders useFactory", {});
      return [
        {
          provide: PERSONA_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || []
        }
      ];
    }
    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      log.error("createAsyncProviders missing useClass/useExisting", {});
      log.warn("forRootAsync requires useFactory, useClass, or useExisting", {});
      throw new Error("PersonaModule.forRootAsync requires useFactory, useClass, or useExisting");
    }
    log.info("using useClass/useExisting for async options", {
      useClass: useClass.name
    });
    log.debug("createAsyncProviders useClass", { useClass: useClass.name });
    return [
      {
        provide: PERSONA_MODULE_OPTIONS,
        useFactory: async (optionsFactory) => await optionsFactory.createPersonaOptions(),
        inject: [useClass]
      },
      ...options.useClass ? [{ provide: useClass, useClass }] : []
    ];
  }
  configure(consumer) {
    this.log.debug("configure start", {
      routePrefix: this.options.routePrefix ?? "/api/persona"
    });
    this.log.trace("configure details", {
      hasOptions: !!this.options,
      hasConsumer: !!consumer
    });
    const routePrefix = this.options.routePrefix ?? "/api/persona";
    this.log.info("binding PersonaMiddleware", { routePrefix });
    if (routePrefix) {
      const normalizedPrefix = routePrefix.endsWith("/*") ? routePrefix : routePrefix.endsWith("/") ? `${routePrefix}*` : `${routePrefix}/*`;
      this.log.debug("middleware route", { routePrefix, normalizedPrefix });
      this.log.trace("middleware binding", { normalizedPrefix, method: "ALL" });
      consumer.apply(exports.PersonaMiddleware).forRoutes({ path: normalizedPrefix, method: common.RequestMethod.ALL });
      this.log.info("PersonaMiddleware bound", { normalizedPrefix });
      this.log.debug("configure complete", { normalizedPrefix });
    } else {
      this.log.warn("empty routePrefix \u2014 middleware not bound", {});
      this.log.debug("configure skipped \u2014 no routePrefix", {});
    }
    this.log.trace("configure finished", { routePrefix });
  }
};
exports.PersonaModule = __decorateClass([
  common.Global(),
  common.Module({}),
  __decorateParam(0, common.Inject(PERSONA_MODULE_OPTIONS))
], exports.PersonaModule);
var VERSION = "0.1.7";

Object.defineProperty(exports, "createLogger", {
  enumerable: true,
  get: function () { return sdk.createLogger; }
});
Object.defineProperty(exports, "createNoopLogger", {
  enumerable: true,
  get: function () { return sdk.createNoopLogger; }
});
exports.PERSONA_CLIENT = PERSONA_CLIENT;
exports.PERSONA_MODULE_OPTIONS = PERSONA_MODULE_OPTIONS;
exports.PERSONA_RUNTIME = PERSONA_RUNTIME;
exports.TranslationError = TranslationError;
exports.VERSION = VERSION;
exports.toRuntimeRequest = toRuntimeRequest;
exports.writeRuntimeResponse = writeRuntimeResponse;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map