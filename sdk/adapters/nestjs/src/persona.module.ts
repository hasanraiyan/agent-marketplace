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
  constructor(
    @Inject(PERSONA_MODULE_OPTIONS)
    private readonly options: PersonaModuleOptions,
  ) {}

  static forRoot(options: PersonaModuleOptions): DynamicModule {
    if (!options.resolveUser && !options.resolveUserFrom) {
      throw new Error(
        'PersonaModule.forRoot: either "resolveUser" or "resolveUserFrom" is required',
      );
    }

    const optionsProvider: Provider = {
      provide: PERSONA_MODULE_OPTIONS,
      useValue: options,
    };

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: () => {
        return createRuntime({
          ...options,
          resolveUser: options.resolveUserFrom
            ? (req) => req.userId ?? null
            : options.resolveUser!,
        });
      },
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: () => {
        return new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
        });
      },
    };

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
    const asyncProviders = this.createAsyncProviders(asyncOptions);

    const runtimeProvider: Provider = {
      provide: PERSONA_RUNTIME,
      useFactory: (options: PersonaModuleOptions) => {
        if (!options.resolveUser && !options.resolveUserFrom) {
          throw new Error(
            'PersonaModule.forRootAsync: either "resolveUser" or "resolveUserFrom" is required',
          );
        }
        return createRuntime({
          ...options,
          resolveUser: options.resolveUserFrom
            ? (req) => req.userId ?? null
            : options.resolveUser!,
        });
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

    const clientProvider: Provider = {
      provide: PERSONA_CLIENT,
      useFactory: (options: PersonaModuleOptions) => {
        return new PersonaClient({
          baseUrl: options.baseUrl,
          credential: options.credential,
          fetch: options.fetch,
        });
      },
      inject: [PERSONA_MODULE_OPTIONS],
    };

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
      throw new Error(
        'PersonaModule.forRootAsync requires useFactory, useClass, or useExisting',
      );
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
    const routePrefix = this.options.routePrefix ?? '/api/persona';
    if (routePrefix) {
      const normalizedPrefix = routePrefix.endsWith('/*')
        ? routePrefix
        : routePrefix.endsWith('/')
          ? `${routePrefix}*`
          : `${routePrefix}/*`;

      consumer
        .apply(PersonaMiddleware)
        .forRoutes({ path: normalizedPrefix, method: RequestMethod.ALL });
    }
  }
}
