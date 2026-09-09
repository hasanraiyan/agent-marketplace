import type { ModuleMetadata, Type } from '@nestjs/common';
import type { CreateRuntimeOptions, ResolveUser } from '@personaai/runtime';
import type { Logger, LogLevel } from '@personaai/logger';

export type NestResolveUser = (req: any) => string | null | Promise<string | null>;

export interface PersonaModuleOptions extends Omit<CreateRuntimeOptions, 'resolveUser'> {
  resolveUser?: ResolveUser;
  resolveUserFrom?: NestResolveUser;
  routePrefix?: string;
  logLevel?: LogLevel;
  logger?: Logger;
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
