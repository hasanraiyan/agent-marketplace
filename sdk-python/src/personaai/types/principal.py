"""Mirrors ``sdk/src/types/principal.ts``. ``TypedDict``s describing the
resolved-principal shapes ``whoami()`` returns."""

from __future__ import annotations

from typing import Literal, TypedDict, Union


class ProjectMachineContext(TypedDict):
    """Resolved from a bare Project credential — acting as the Project itself."""

    domain: str
    principalType: Literal["ProjectMachine"]
    credentialId: str


class ProjectRuntimeContext(TypedDict):
    """Resolved from a Project credential paired with ``x-persona-external-user-id``."""

    domain: str
    principalType: Literal["ProjectRuntime"]
    credentialId: str
    externalUserId: str


PrincipalContext = Union[ProjectMachineContext, ProjectRuntimeContext]
