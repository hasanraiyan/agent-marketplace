/** A Provider as returned by the API — `apiKey` is never included. */
export interface Provider {
  id: string;
  label: string;
  baseURL: string;
  defaultModel: string;
  /** At most one Provider per Domain has this set — used as the fallback when an Agent has no `providerId`. */
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  /** Human-readable name shown in your own UI, e.g. `"OpenAI (prod)"`. */
  label: string;
  /** OpenAI-compatible base URL, e.g. `"https://api.openai.com/v1"`. */
  baseURL: string;
  /** Plaintext API key — encrypted at rest, never returned in any response. */
  apiKey: string;
  /** Model id used when an Agent references this Provider without its own `modelName`. */
  defaultModel: string;
  /** @default false */
  isDefault?: boolean;
}

/** All fields optional — only what you pass is changed. */
export interface UpdateProviderInput {
  label?: string;
  baseURL?: string;
  /** Replaces the stored key entirely; omit to leave the existing key untouched. */
  apiKey?: string;
  defaultModel?: string;
  isDefault?: boolean;
}

export interface ProviderModel {
  id: string;
}

export interface ProviderTestConnectionResult {
  /** `false` means the endpoint rejected the credentials/URL, not that the request itself failed. */
  success: boolean;
  message: string;
}
