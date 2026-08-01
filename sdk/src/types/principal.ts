/** Resolved from a bare Project credential — acting as the Project itself. */
export interface ProjectMachineContext {
  domain: string;
  principalType: 'ProjectMachine';
  credentialId: string;
}

/** Resolved from a Project credential paired with `x-persona-external-user-id`. */
export interface ProjectRuntimeContext {
  domain: string;
  principalType: 'ProjectRuntime';
  credentialId: string;
  externalUserId: string;
}

export type PrincipalContext = ProjectMachineContext | ProjectRuntimeContext;
