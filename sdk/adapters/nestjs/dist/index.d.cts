import { ModuleMetadata, Type, OnModuleDestroy, NestMiddleware, NestModule, DynamicModule, MiddlewareConsumer } from '@nestjs/common';
import { CreateRuntimeOptions, ResolveUser, Runtime, RuntimeRequest, RuntimeResponse } from '@personaai/runtime';
import { LogLevel, Logger, PersonaClient } from '@personaai/sdk';
export { LogLevel, Logger, createLogger, createNoopLogger } from '@personaai/sdk';

declare const PERSONA_MODULE_OPTIONS: unique symbol;
declare const PERSONA_RUNTIME: unique symbol;
declare const PERSONA_CLIENT: unique symbol;

/**
 * Resolves the external user identity from the incoming request in NestJS.
 * Can be synchronous or asynchronous. Returns `null` if unauthenticated.
 */
type NestResolveUser = (req: any) => string | null | Promise<string | null>;
interface PersonaModuleOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
    /**
     * Runtime-level user resolver — receives the translated request and returns
     * the external user id, or `null` → the runtime responds 401.
     */
    resolveUser?: ResolveUser;
    /**
     * NestJS request-level user resolver. Receives the raw incoming request
     * (after guards/middleware) and returns the external user id.
     */
    resolveUserFrom?: NestResolveUser;
    /**
     * Route path prefix to mount the Persona runtime middleware.
     * Default: `/api/persona`
     */
    routePrefix?: string;
    /** Log level for the adapter and the underlying runtime — off by default. */
    logLevel?: LogLevel;
    /** Custom logger instance — when provided, `logLevel` is ignored. */
    logger?: Logger;
}
interface PersonaOptionsFactory {
    createPersonaOptions(): Promise<PersonaModuleOptions> | PersonaModuleOptions;
}
interface PersonaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
    useExisting?: Type<PersonaOptionsFactory>;
    useClass?: Type<PersonaOptionsFactory>;
    useFactory?: (...args: any[]) => Promise<PersonaModuleOptions> | PersonaModuleOptions;
    inject?: any[];
}

declare class PersonaService implements OnModuleDestroy {
    readonly options: PersonaModuleOptions;
    readonly runtime: Runtime;
    readonly client: PersonaClient;
    private readonly logger;
    private readonly log;
    constructor(options: PersonaModuleOptions, runtime: Runtime, client: PersonaClient);
    /**
     * Constructs a PersonaClient scoped to a specific end-user.
     * Use this to create threads, run AG-UI streaming chats, or manage user files.
     */
    forUser(externalUserId: string): PersonaClient;
    onModuleDestroy(): Promise<void>;
}

declare class PersonaMiddleware implements NestMiddleware {
    private readonly options;
    private readonly runtime;
    private readonly logger;
    private readonly log;
    constructor(options: PersonaModuleOptions, runtime: Runtime);
    use(req: any, res: any, next: (error?: any) => void): Promise<void>;
}

declare class PersonaModule implements NestModule {
    private readonly options;
    private readonly logger;
    private readonly log;
    constructor(options: PersonaModuleOptions);
    static forRoot(options: PersonaModuleOptions): DynamicModule;
    static forRootAsync(asyncOptions: PersonaModuleAsyncOptions): DynamicModule;
    private static createAsyncProviders;
    configure(consumer: MiddlewareConsumer): void;
}

declare class TranslationError extends Error {
    constructor(message: string);
}
declare function toRuntimeRequest(req: any, logger?: Logger): Promise<RuntimeRequest>;

declare function writeRuntimeResponse(res: any, response: RuntimeResponse, logger?: Logger): Promise<void>;

declare const VERSION = "0.1.7";

export { type NestResolveUser, PERSONA_CLIENT, PERSONA_MODULE_OPTIONS, PERSONA_RUNTIME, PersonaMiddleware, PersonaModule, type PersonaModuleAsyncOptions, type PersonaModuleOptions, type PersonaOptionsFactory, PersonaService, TranslationError, VERSION, toRuntimeRequest, writeRuntimeResponse };
