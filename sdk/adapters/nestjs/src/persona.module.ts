import {
  DynamicModule,
  Global,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
  RequestMethod,
} from '@nestjs/common';
import { createRuntime } from '@personaai/runtime';
import { createLogger, type Logger } from '@personaai/sdk';
import { PersonaClient } from '@personaai/sdk';
import { PERSONA_CLIENT, PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME } from './constants.js';
import type {
  PersonaModuleAsyncOptions,
  PersonaModuleOptions,
  PersonaOptionsFactory,
} from './interfaces/persona-options.interface.js';
import { PersonaMiddleware } from './persona.middleware.js';
import { PersonaService } from './persona.service.js';

@Global()
@Module({})
export class PersonaModule implements NestModule {
  private readonly logger: Logger;
  private readonly log: Logger;

  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    private readonly options: PersonaModuleOptions
  ) {
    this.logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    this.log = this.logger.child('module');
    this.log.debug('PersonaModule constructed', {
      routePrefix: options.routePrefix ?? '/api/persona',
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
    });
    this.log.trace('PersonaModule config', {
      hasBaseUrl: !!options.baseUrl,
      hasLogger: !!options.logger,
      hasLogLevel: !!options.logLevel,
      mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
    });
  }

  static forRoot(options: PersonaModuleOptions): DynamicModule {
    const logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    const log = logger.child('module');

    log.debug('PersonaModule.forRoot init', {
      hasBaseUrl: !!options.baseUrl,
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
      mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
      routePrefix: options.routePrefix ?? '/api/persona',
    });
    log.trace('PersonaModule.forRoot config', {
      hasHooks: !!(options as any).hooks,
      capabilities: (options as any).capabilities,
      hasLogLevel: !!options.logLevel,
      hasLogger: !!options.logger,
      hasFetch: !!options.fetch,
    });

    if (!options.resolveUser && !options.resolveUserFrom) {
      log.error('PersonaModule.forRoot missing resolver', {});
      log.warn('neither resolveUser nor resolveUserFrom provided', {});
      throw new Error(
        'PersonaModule.forRoot: either "resolveUser" or "resolveUserFrom" is required'
      );
    }

    if (options.resolveUser && options.resolveUserFrom) {
      log.warn('both resolveUser and resolveUserFrom provided — resolveUserFrom will win', {});
    }

    log.info('PersonaModule.forRoot creating providers', {
      hasResolveUserFrom: !!options.resolveUserFrom,
      mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
    });

    const optionsProvider: Provider = {
      provide: PERSONA_MODULE_OPTIONS,
      useValue: options,
    };

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: () => {
        log.debug('runtimeProvider factory start', {
          hasResolveUserFrom: !!options.resolveUserFrom,
        });
        log.trace('runtimeProvider config', {
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          hasLogLevel: !!options.logLevel,
          hasLogger: !!options.logger,
        });
        const runtime = createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser!,
        });
        log.debug('runtime created', {
          hasResolveUserFrom: !!options.resolveUserFrom,
        });
        log.info('runtime created for forRoot', {
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
        });
        log.trace('runtime details', {});
        return runtime;
      },
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: () => {
        log.debug('clientProvider factory start', {
          hasBaseUrl: !!options.baseUrl,
        });
        log.trace('clientProvider config', { hasFetch: !!options.fetch });
        const loggerForClient =
          options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const clientLogger = loggerForClient.child('client');
        clientLogger.debug('creating PersonaClient', {
          hasBaseUrl: !!options.baseUrl,
        });
        const client = new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...(options.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
          ...(options.logger ? { logger: options.logger } : {}),
        });
        log.debug('PersonaClient created', { hasBaseUrl: !!options.baseUrl });
        log.info('client created for forRoot', {});
        return client;
      },
    };

    log.info('PersonaModule.forRoot providers ready', {});
    log.debug('PersonaModule.forRoot ready', {});

    return {
      module: PersonaModule,
      providers: [
        optionsProvider,
        runtimeProvider,
        clientProvider,
        PersonaService,
        PersonaMiddleware,
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        PersonaService,
        PersonaMiddleware,
      ],
    };
  }

  static forRootAsync(asyncOptions: PersonaModuleAsyncOptions): DynamicModule {
    // For async, we can't know options yet — log at factory time.
    const staticLogger = createLogger('adapter:nestjs', {});
    const staticLog = staticLogger.child('module');
    staticLog.debug('PersonaModule.forRootAsync init', {
      hasUseFactory: !!asyncOptions.useFactory,
      hasUseClass: !!asyncOptions.useClass,
      hasUseExisting: !!asyncOptions.useExisting,
      hasImports: !!(asyncOptions.imports && asyncOptions.imports.length),
    });
    staticLog.trace('PersonaModule.forRootAsync config', {
      injectCount: asyncOptions.inject?.length ?? 0,
    });

    const asyncProviders = this.createAsyncProviders(asyncOptions);

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: (options: PersonaModuleOptions) => {
        const logger =
          options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const log = logger.child('module');
        log.debug('forRootAsync runtimeProvider factory start', {
          hasBaseUrl: !!options.baseUrl,
          hasResolveUser: !!options.resolveUser,
          hasResolveUserFrom: !!options.resolveUserFrom,
        });
        log.trace('forRootAsync runtimeProvider config', {
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          hasLogLevel: !!options.logLevel,
          hasLogger: !!options.logger,
        });
        if (!options.resolveUser && !options.resolveUserFrom) {
          log.error('PersonaModule.forRootAsync missing resolver', {});
          log.warn('neither resolveUser nor resolveUserFrom provided (async)', {});
          throw new Error(
            'PersonaModule.forRootAsync: either "resolveUser" or "resolveUserFrom" is required'
          );
        }
        if (options.resolveUser && options.resolveUserFrom) {
          log.warn(
            'both resolveUser and resolveUserFrom provided — resolveUserFrom will win (async)',
            {}
          );
        }
        log.info('creating runtime (async)', {
          hasResolveUserFrom: !!options.resolveUserFrom,
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
        });
        const runtime = createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser!,
        });
        log.debug('runtime created (async)', {
          hasResolveUserFrom: !!options.resolveUserFrom,
        });
        log.info('runtime created for forRootAsync', {});
        return runtime;
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: (options: PersonaModuleOptions) => {
        const logger =
          options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const log = logger.child('module');
        log.debug('forRootAsync clientProvider factory start', {
          hasBaseUrl: !!options.baseUrl,
        });
        log.trace('clientProvider async config', { hasFetch: !!options.fetch });
        const client = new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...(options.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
          ...(options.logger ? { logger: options.logger } : {}),
        });
        log.debug('PersonaClient created (async)', {
          hasBaseUrl: !!options.baseUrl,
        });
        log.info('client created for forRootAsync', {});
        return client;
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

    staticLog.info('PersonaModule.forRootAsync providers ready', {});
    staticLog.debug('PersonaModule.forRootAsync ready', {});

    return {
      module: PersonaModule,
      imports: asyncOptions.imports || [],
      providers: [
        ...asyncProviders,
        runtimeProvider,
        clientProvider,
        PersonaService,
        PersonaMiddleware,
      ],
      exports: [
        PERSONA_MODULE_OPTIONS,
        PERSONA_RUNTIME,
        PERSONA_CLIENT,
        PersonaService,
        PersonaMiddleware,
      ],
    };
  }

  private static createAsyncProviders(options: PersonaModuleAsyncOptions): Provider[] {
    const log = createLogger('adapter:nestjs', {}).child('module');
    log.debug('createAsyncProviders start', {
      hasUseFactory: !!options.useFactory,
      hasUseClass: !!options.useClass,
      hasUseExisting: !!options.useExisting,
    });
    log.trace('createAsyncProviders details', {
      hasImports: !!(options.imports && options.imports.length),
      injectCount: options.inject?.length ?? 0,
    });
    if (options.useFactory) {
      log.info('using useFactory for async options', {});
      log.debug('createAsyncProviders useFactory', {});
      return [
        {
          provide: PERSONA_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    const useClass = options.useClass || options.useExisting;
    if (!useClass) {
      log.error('createAsyncProviders missing useClass/useExisting', {});
      log.warn('forRootAsync requires useFactory, useClass, or useExisting', {});
      throw new Error('PersonaModule.forRootAsync requires useFactory, useClass, or useExisting');
    }

    log.info('using useClass/useExisting for async options', {
      useClass: useClass.name,
    });
    log.debug('createAsyncProviders useClass', { useClass: useClass.name });

    return [
      {
        provide: PERSONA_MODULE_OPTIONS,
        useFactory: async (optionsFactory: PersonaOptionsFactory) =>
          await optionsFactory.createPersonaOptions(),
        inject: [useClass],
      },
      ...(options.useClass ? [{ provide: useClass, useClass }] : []),
    ];
  }

  configure(consumer: MiddlewareConsumer) {
    this.log.debug('configure start', {
      routePrefix: this.options.routePrefix ?? '/api/persona',
    });
    this.log.trace('configure details', {
      hasOptions: !!this.options,
      hasConsumer: !!consumer,
    });
    const routePrefix = this.options.routePrefix ?? '/api/persona';
    this.log.info('binding PersonaMiddleware', { routePrefix });
    if (routePrefix) {
      const normalizedPrefix = routePrefix.endsWith('/*')
        ? routePrefix
        : routePrefix.endsWith('/')
          ? `${routePrefix}*`
          : `${routePrefix}/*`;

      this.log.debug('middleware route', { routePrefix, normalizedPrefix });
      this.log.trace('middleware binding', { normalizedPrefix, method: 'ALL' });

      consumer
        .apply(PersonaMiddleware)
        .forRoutes({ path: normalizedPrefix, method: RequestMethod.ALL });

      this.log.info('PersonaMiddleware bound', { normalizedPrefix });
      this.log.debug('configure complete', { normalizedPrefix });
    } else {
      this.log.warn('empty routePrefix — middleware not bound', {});
      this.log.debug('configure skipped — no routePrefix', {});
    }
    this.log.trace('configure finished', { routePrefix });
  }
}
