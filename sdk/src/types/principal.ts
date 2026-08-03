/** Resolved from a bare Project credential — acting as the Project itself. */
export interface ProjectMachineContext {
  /** The Project's own scoping key — every resource this credential can see belongs to this Domain. */
  domain: string;
  principalType: 'ProjectMachine';
  /** The Project credential's own id (not a secret). */
  credentialId: string;
}

/** Resolved from a Project credential paired with `x-persona-external-user-id` (i.e. `PersonaClientOptions.externalUserId` was set). */
export interface ProjectRuntimeContext {
  domain: string;
  principalType: 'ProjectRuntime';
  credentialId: string;
  /** The asserted end user's id, as passed to `new PersonaClient({ externalUserId })`. */
  externalUserId: string;
}

/** Returned by `client.whoami()` — tells you which of the two shapes above this client's credential resolved to. */
export type PrincipalContext = ProjectMachineContext | ProjectRuntimeContext;
