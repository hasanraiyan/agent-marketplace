import type { ModuleMetadata, Type } from '@nestjs/common';
import type { CreateRuntimeOptions, ResolveUser } from '@personaai/runtime';

/**
 * Resolves the external user identity from the incoming request in NestJS.
 * Can be synchronous or asynchronous. Returns `null` if unauthenticated.
 */
export type NestResolveUser = (req: any) => string | null | Promise<string | null>;

export interface PersonaModuleOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
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
}

export interface PersonaOptionsFactory {
  createPersonaOptions(): Promise<PersonaModuleOptions> | PersonaModuleOptions;
}

export interface PersonaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<PersonaOptionsFactory>;
  useClass?: Type<PersonaOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<PersonaModuleOptions> | PersonaModuleOptions;
  inject?: any[];
}
