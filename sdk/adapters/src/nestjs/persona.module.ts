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
import { createLogger, type Logger } from '@personaai/logger';
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
    private readonly options: PersonaModuleOptions,
  ) {
    this.logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
    this.log = this.logger.child('module');
    this.log.debug('PersonaModule constructed', {
      routePrefix: options.routePrefix ?? '/api/persona',
      hasResolveUser: !!options.resolveUser,
      hasResolveUserFrom: !!options.resolveUserFrom,
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
    });

    if (!options.resolveUser && !options.resolveUserFrom) {
      log.error('PersonaModule.forRoot missing resolver', {});
      throw new Error('PersonaModule.forRoot: either "resolveUser" or "resolveUserFrom" is required');
    }

    if (options.resolveUser && options.resolveUserFrom) {
      log.warn('both resolveUser and resolveUserFrom provided — resolveUserFrom will win', {});
    }

    const optionsProvider: Provider = {
      provide: PERSONA_MODULE_OPTIONS,
      useValue: options,
    };

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: () => {
        log.debug('runtimeProvider factory start', { hasResolveUserFrom: !!options.resolveUserFrom });
        const runtime = createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser!,
        });
        log.debug('runtime created', { hasResolveUserFrom: !!options.resolveUserFrom });
        return runtime;
      },
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: () => {
        log.debug('clientProvider factory start', { hasBaseUrl: !!options.baseUrl });
        const loggerForClient = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const client = new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...(options.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
          ...(options.logger ? { logger: options.logger } : {}),
        });
        log.debug('PersonaClient created', { hasBaseUrl: !!options.baseUrl });
        return client;
      },
    };

    log.info('PersonaModule.forRoot providers ready', {});

    return {
      module: PersonaModule,
      providers: [optionsProvider, runtimeProvider, clientProvider, PersonaService, PersonaMiddleware],
      exports: [PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME, PERSONA_CLIENT, PersonaService, PersonaMiddleware],
    };
  }

  static forRootAsync(asyncOptions: PersonaModuleAsyncOptions): DynamicModule {
    const staticLogger = createLogger('adapter:nestjs', {});
    const staticLog = staticLogger.child('module');
    staticLog.debug('PersonaModule.forRootAsync init', {
      hasUseFactory: !!asyncOptions.useFactory,
      hasUseClass: !!asyncOptions.useClass,
      hasUseExisting: !!asyncOptions.useExisting,
    });

    const asyncProviders = this.createAsyncProviders(asyncOptions);

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: (options: PersonaModuleOptions) => {
        const logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const log = logger.child('module');
        if (!options.resolveUser && !options.resolveUserFrom) {
          log.error('PersonaModule.forRootAsync missing resolver', {});
          throw new Error('PersonaModule.forRootAsync: either "resolveUser" or "resolveUserFrom" is required');
        }
        if (options.resolveUser && options.resolveUserFrom) {
          log.warn('both resolveUser and resolveUserFrom provided — resolveUserFrom will win (async)', {});
        }
        const runtime = createRuntime({
          ...options,
          mountPath: options.mountPath ?? options.routePrefix ?? '/api/persona',
          resolveUser: options.resolveUserFrom ? (req) => req.userId ?? null : options.resolveUser!,
        });
        log.debug('runtime created (async)', { hasResolveUserFrom: !!options.resolveUserFrom });
        return runtime;
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: (options: PersonaModuleOptions) => {
        const logger = options.logger ?? createLogger('adapter:nestjs', { level: options.logLevel });
        const client = new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
          ...(options.logLevel !== undefined ? { logLevel: options.logLevel } : {}),
          ...(options.logger ? { logger: options.logger } : {}),
        });
        return client;
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

    staticLog.info('PersonaModule.forRootAsync providers ready', {});

    return {
      module: PersonaModule,
      imports: asyncOptions.imports || [],
      providers: [...asyncProviders, runtimeProvider, clientProvider, PersonaService, PersonaMiddleware],
      exports: [PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME, PERSONA_CLIENT, PersonaService, PersonaMiddleware],
    };
  }

  private static createAsyncProviders(options: PersonaModuleAsyncOptions): Provider[] {
    const log = createLogger('adapter:nestjs', {}).child('module');
    if (options.useFactory) {
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
      throw new Error('PersonaModule.forRootAsync requires useFactory, useClass, or useExisting');
    }

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
    this.log.debug('configure start', { routePrefix: this.options.routePrefix ?? '/api/persona' });
    const routePrefix = this.options.routePrefix ?? '/api/persona';
    this.log.info('binding PersonaMiddleware', { routePrefix });
    if (routePrefix) {
      const normalizedPrefix = routePrefix.endsWith('/*')
        ? routePrefix
        : routePrefix.endsWith('/')
          ? `${routePrefix}*`
          : `${routePrefix}/*`;

      this.log.debug('middleware route', { routePrefix, normalizedPrefix });

      consumer.apply(PersonaMiddleware).forRoutes({ path: normalizedPrefix, method: RequestMethod.ALL });

      this.log.info('PersonaMiddleware bound', { normalizedPrefix });
    } else {
      this.log.warn('empty routePrefix — middleware not bound', {});
    }
  }
}
