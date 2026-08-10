"""Mirrors ``sdk/src/types/store.ts``."""

from __future__ import annotations

from typing import Literal, TypedDict

StoreScope = Literal["domain", "externalUser"]
StoreAccessMode = Literal["readonly", "readwrite"]


class Store(TypedDict):
    """A named, scoped mount point assignable to Agents (``Agent.storeMounts``),
    generalizing the fixed ``/memories/user/``/``/memories/agent/`` mounts into
    arbitrarily-named ones. Mounted at ``/stores/<name>/`` in the Agent's
    filesystem."""

    _id: str
    domain: str
    name: str
    description: str
    # 'domain': one shared namespace for the whole Project. 'externalUser': one
    # namespace per external user, resolved per Agent run. Immutable after
    # creation.
    scope: StoreScope
    # 'readonly': Agents can read but never write via their own tool calls —
    # content is populated only through this API. 'readwrite': Agents can also
    # write_file/edit_file into it.
    accessMode: StoreAccessMode
    createdAt: str
    updatedAt: str


class CreateStoreInput(TypedDict):
    name: str  # lowercase letters, numbers, hyphens only
    scope: StoreScope
    description: str | None
    accessMode: StoreAccessMode  # default: 'readwrite'


class UpdateStoreInput(TypedDict, total=False):
    """``scope`` is intentionally not included — immutable after creation."""

    name: str
    description: str
    accessMode: StoreAccessMode


class DiscoverStoresParams(TypedDict, total=False):
    page: int  # default: 1
    limit: int  # default: 20
    search: str  # free-text match against name


class StoreFile(TypedDict):
    path: str
    content: str
    mimeType: str
    createdAt: str
    updatedAt: str


class GetStoreFileParams(TypedDict):
    path: str


class DeleteStoreFileParams(TypedDict):
    path: str


class WriteStoreFileInput(TypedDict):
    path: str
    content: str
