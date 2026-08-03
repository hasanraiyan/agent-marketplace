"""Mirrors ``sdk/src/types/mcp.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict

McpTransport = Literal["http", "sse"]
McpAuthType = Literal["none", "oauth", "apiKey"]
# "owner": one shared connection for the whole Project.
# "user": each external user connects their own.
McpAuthMode = Literal["owner", "user"]


class McpTool(TypedDict):
    name: str
    description: str


class McpResourceSummary(TypedDict):
    uri: str
    name: str
    description: str
    mimeType: str


class McpResourceTemplate(TypedDict):
    """A resource whose ``uri`` has placeholder params to fill before
    calling ``read_resource()``."""

    uriTemplate: str
    name: str
    description: str
    mimeType: str
    toolName: str


class McpOAuthConfig(TypedDict):
    clientId: str | None
    hasClientSecret: bool
    authorizationEndpoint: str | None
    tokenEndpoint: str | None
    scopes: list[str]
    dynamicallyRegistered: bool
    ownerConnected: bool  # whether the MCP's owner completed the owner-mode OAuth flow


class _McpRequired(TypedDict):
    _id: str
    domain: str
    ownerType: Literal["PersonaUser", "Project", "ExternalUser"]
    name: str
    transport: McpTransport
    url: str
    authType: McpAuthType
    authMode: McpAuthMode
    hasApiKey: bool
    isEnabled: bool
    tools: list[
        McpTool
    ]  # populated by test_connection(); empty until it's been called at least once
    resources: list[McpResourceSummary]  # populated by test_connection()
    resourceTemplates: list[McpResourceTemplate]  # populated by test_connection()
    createdAt: str
    updatedAt: str


class Mcp(_McpRequired, total=False):
    """Like ``Provider`` (not ``Skill``/``Agent``/``Knowledge``), this goes
    through a clean ``toSafeJson()`` DTO — ``oauth``/``apiKeyEncrypted`` are
    stripped in favor of ``hasApiKey``/a summarized ``oauth`` object. Still
    ``_id``-shaped, though (``toSafeJson`` spreads the raw document minus
    secrets, doesn't rename it)."""

    ownerId: str
    externalOwnerId: str
    description: str
    oauth: McpOAuthConfig


class _McpOAuthInputRequired(TypedDict):
    clientId: str
    clientSecret: str


class McpOAuthInput(_McpOAuthInputRequired, total=False):
    scopes: list[str]


class PartialMcpOAuthInput(TypedDict, total=False):
    clientId: str
    clientSecret: str
    scopes: list[str]


class _CreateMcpInputRequired(TypedDict):
    name: str
    transport: McpTransport
    url: str


class CreateMcpInput(_CreateMcpInputRequired, total=False):
    description: str
    authType: McpAuthType  # default: 'none'
    authMode: McpAuthMode  # default: 'owner'
    oauth: McpOAuthInput  # required when authType='oauth' and no dynamic registration
    # required when authType='apiKey'; sent as a static bearer token — always
    # owner-shared, regardless of authMode
    apiKey: str
    useDynamicRegistration: (
        bool  # RFC 7591 Dynamic Client Registration instead of a manual oauth block; default: False
    )
    isEnabled: bool  # default: True


class UpdateMcpInput(TypedDict, total=False):
    """All fields optional — only what you pass is changed."""

    name: str
    description: str
    transport: McpTransport
    url: str
    authType: McpAuthType
    authMode: McpAuthMode
    isEnabled: bool
    useDynamicRegistration: bool
    oauth: PartialMcpOAuthInput
    apiKey: str  # replaces the stored key entirely; omit to leave the existing key untouched


class DiscoverMcpsParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
    search: str  # free-text match against name/description
    scope: Literal["mine"]  # restricts to the asserted external user's own MCPs (runtime-only)


class McpTestConnectionResult(TypedDict):
    tools: list[McpTool]
    resources: list[McpResourceSummary]
    resourceTemplates: list[McpResourceTemplate]


class McpReadResourceResult(TypedDict):
    text: str
    mimeType: str


class McpUserConnectionStatus(TypedDict):
    connected: bool


class McpAuthorizeUrl(TypedDict):
    url: str
