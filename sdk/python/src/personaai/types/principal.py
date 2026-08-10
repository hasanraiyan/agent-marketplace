"""Mirrors ``sdk/src/types/principal.ts``. ``TypedDict``s describing the
resolved-principal shapes ``whoami()`` returns."""

from __future__ import annotations

from typing import Literal, TypedDict, Union


class ProjectMachineContext(TypedDict):
    """Resolved from a bare Project credential — acting as the Project itself."""

    domain: (
        str  # the Project's own scoping key — every resource this credential can see belongs here
    )
    principalType: Literal["ProjectMachine"]
    credentialId: str  # the Project credential's own id (not a secret)


class ProjectRuntimeContext(TypedDict):
    """Resolved from a Project credential paired with ``x-persona-external-user-id``
    (i.e. ``external_user_id`` was set when constructing the client)."""

    domain: str
    principalType: Literal["ProjectRuntime"]
    credentialId: str
    externalUserId: str  # the asserted end user's id, as passed to the client constructor


# Returned by client.whoami() — tells you which of the two shapes above this
# client's credential resolved to.
PrincipalContext = Union[ProjectMachineContext, ProjectRuntimeContext]
