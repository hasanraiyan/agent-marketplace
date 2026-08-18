import { Injectable, Inject, Global, Module, RequestMethod } from '@nestjs/common';
import { PersonaClient } from '@personaai/sdk';
import { Readable } from 'stream';
import { createRuntime } from '@personaai/runtime';

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
var PersonaService = class {
  constructor(options, runtime, client) {
    this.options = options;
    this.runtime = runtime;
    this.client = client;
  }
  options;
  runtime;
  client;
  /**
   * Constructs a PersonaClient scoped to a specific end-user.
   * Use this to create threads, run AG-UI streaming chats, or manage user files.
   */
  forUser(externalUserId) {
    return new PersonaClient({
      baseUrl: this.options.baseUrl,
      credential: this.options.credential,
      externalUserId,
      fetch: this.options.fetch
    });
  }
  async onModuleDestroy() {
    if (typeof this.runtime.close === "function") {
      await this.runtime.close();
    }
  }
};
PersonaService = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(PERSONA_MODULE_OPTIONS)),
  __decorateParam(1, Inject(PERSONA_RUNTIME)),
  __decorateParam(2, Inject(PERSONA_CLIENT))
], PersonaService);
function toUploadedFile(file) {
  return {
    filename: file.originalname,
    content: new Uint8Array(file.buffer),
    contentType: file.mimetype || void 0
  };
}
function collectMulterFiles(req) {
  const multerReq = req;
  const file = multerReq.file;
  const files = multerReq.files;
  if (!file && !files) return null;
  const mappedFile = file ? toUploadedFile(file) : void 0;
  const array = Array.isArray(files) ? files : files ? Object.values(files).flat() : [];
  return {
    file: mappedFile,
    files: array.length > 0 ? array.map(toUploadedFile) : void 0
  };
}
async function parseMultipart(req, contentType) {
  const request = new Request("http://internal/", {
    method: "POST",
    headers: { "content-type": contentType },
    body: Readable.toWeb(req),
    duplex: "half"
  });
  const formData = await request.formData();
  let file;
  const files = [];
  const fields = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      const uploaded = {
        filename: value.name,
        content: new Uint8Array(await value.arrayBuffer()),
        contentType: value.type || void 0
      };
      if (key === "file") file = uploaded;
      else if (key === "files") files.push(uploaded);
    } else {
      fields[key] = value;
    }
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
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return void 0;
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.length === 0) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    throw new TranslationError("Request body is not valid JSON.");
  }
}
async function toRuntimeRequest(req) {
  const method = (req.method ?? "GET").toUpperCase();
  const url = new URL(req.originalUrl || req.url, "http://localhost");
  const query = {};
  for (const [key, value] of url.searchParams) query[key] = value;
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  const bodyless = method === "GET" || method === "DELETE";
  const contentTypeHeader = headers["content-type"] ?? "";
  const contentType = contentTypeHeader.toLowerCase();
  let body;
  let file;
  let files;
  if (!bodyless && contentType.includes("multipart/form-data")) {
    const parsedByHost = collectMulterFiles(req);
    if (parsedByHost) {
      file = parsedByHost.file;
      files = parsedByHost.files;
      body = req.body;
    } else if (req.readableEnded) {
      throw new TranslationError(
        "Multipart request body was consumed by a body parser before the Persona adapter could read it. Mount the adapter before any multipart body parser, or remove the parser."
      );
    } else {
      try {
        const parsed = await parseMultipart(req, contentTypeHeader);
        file = parsed.file;
        files = parsed.files;
        body = parsed.body;
      } catch (err) {
        if (err instanceof TranslationError) throw err;
        throw new TranslationError(
          `Multipart request body could not be parsed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  } else if (!bodyless) {
    body = req.body ?? await readJsonBody(req);
  }
  return {
    method,
    path: req.path || url.pathname,
    headers,
    query,
    body,
    file,
    files,
    userId: null
  };
}

// src/write.ts
function waitForDrainOrClose(res) {
  return new Promise((resolve) => {
    const cleanup = () => {
      res.off("drain", onDrain);
      res.off("close", onClose);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      resolve();
    };
    res.once("drain", onDrain);
    res.once("close", onClose);
  });
}
async function writeRuntimeResponse(res, response) {
  res.status(response.status);
  for (const [key, value] of Object.entries(response.headers)) {
    res.set ? res.set(key, value) : res.setHeader?.(key, value);
  }
  if (response.kind === "buffered") {
    res.end(response.body);
    return;
  }
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
  const body = response.body;
  const iterator = body[Symbol.asyncIterator]();
  const iterable = { [Symbol.asyncIterator]: () => iterator };
  let closed = false;
  const onClose = () => {
    closed = true;
    const returned = iterator.return?.();
    if (returned) void returned.catch(() => {
    });
  };
  res.on("close", onClose);
  try {
    for await (const chunk of iterable) {
      if (closed) break;
      const canContinue = res.write(chunk);
      if (!canContinue) await waitForDrainOrClose(res);
    }
    if (!closed) res.end();
  } finally {
    res.off("close", onClose);
  }
}

// src/persona.middleware.ts
var PersonaMiddleware = class {
  constructor(options, runtime) {
    this.options = options;
    this.runtime = runtime;
  }
  options;
  runtime;
  async use(req, res, next) {
    try {
      const request = await toRuntimeRequest(req);
      if (this.options.resolveUserFrom) {
        try {
          request.userId = await this.options.resolveUserFrom(req);
        } catch {
          request.userId = null;
        }
      }
      const response = await this.runtime.handle(request);
      await writeRuntimeResponse(res, response);
    } catch (err) {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof TranslationError) {
        res.status(400).json({ error: { code: "INVALID_REQUEST", message: err.message } });
        return;
      }
      next(err);
    }
  }
};
PersonaMiddleware = __decorateClass([
  Injectable(),
  __decorateParam(0, Inject(PERSONA_MODULE_OPTIONS)),
  __decorateParam(1, Inject(PERSONA_RUNTIME))
], PersonaMiddleware);
var PersonaModule = class {
  constructor(options) {
    this.options = options;
  }
  options;
  static forRoot(options) {
    if (!options.resolveUser && !options.resolveUserFrom) {
      throw new Error(
        'PersonaModule.forRoot: either "resolveUser" or "resolveUserFrom" is required'
      );
    }
    const optionsProvider = {
      provide: PERSONA_MODULE_OPTIONS,
      useValue: options
    };
    const runtimeProvider = {
      provide: PERSONA_RUNTIME,
      useFactory: () => {
        return createRuntime({
          ...options,
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser
        });
      }
    };
    const clientProvider = {
      provide: PERSONA_CLIENT,
      useFactory: () => {
        return new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch
        });
      }
    };
    return {
      module: PersonaModule,
      providers: [
        optionsProvider,
        runtimeProvider,
        clientProvider,
        PersonaService,
        PersonaMiddleware
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        PersonaService,
        PersonaMiddleware
      ]
    };
  }
  static forRootAsync(asyncOptions) {
    const asyncProviders = this.createAsyncProviders(asyncOptions);
    const runtimeProvider = {
      provide: PERSONA_RUNTIME,
      useFactory: (options) => {
        if (!options.resolveUser && !options.resolveUserFrom) {
          throw new Error(
            'PersonaModule.forRootAsync: either "resolveUser" or "resolveUserFrom" is required'
          );
        }
        return createRuntime({
          ...options,
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser
        });
      },
      inject: [PERSONA_MODULE_OPTIONS]
    };
    const clientProvider = {
      provide: PERSONA_CLIENT,
      useFactory: (options) => {
        return new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch
        });
      },
      inject: [PERSONA_MODULE_OPTIONS]
    };
    return {
      module: PersonaModule,
      imports: asyncOptions.imports || [],
      providers: [
        ...asyncProviders,
        runtimeProvider,
        clientProvider,
        PersonaService,
        PersonaMiddleware
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        PersonaService,
        PersonaMiddleware
      ]
    };
  }
  static createAsyncProviders(options) {
    if (options.useFactory) {
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
      throw new Error(
        "PersonaModule.forRootAsync requires useFactory, useClass, or useExisting"
      );
    }
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
    const routePrefix = this.options.routePrefix ?? "/api/persona";
    if (routePrefix) {
      const normalizedPrefix = routePrefix.endsWith("/*") ? routePrefix : routePrefix.endsWith("/") ? `${routePrefix}*` : `${routePrefix}/*`;
      consumer.apply(PersonaMiddleware).forRoutes({ path: normalizedPrefix, method: RequestMethod.ALL });
    }
  }
};
PersonaModule = __decorateClass([
  Global(),
  Module({}),
  __decorateParam(0, Inject(PERSONA_MODULE_OPTIONS))
], PersonaModule);

// src/index.ts
var VERSION = "0.1.0";

export { PERSONA_CLIENT, PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME, PersonaMiddleware, PersonaModule, PersonaService, TranslationError, VERSION, toRuntimeRequest, writeRuntimeResponse };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map