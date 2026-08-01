export interface Provider {
  id: string;
  label: string;
  baseURL: string;
  defaultModel: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderInput {
  label: string;
  baseURL: string;
  /** Plaintext API key — encrypted at rest, never returned in any response. */
  apiKey: string;
  defaultModel: string;
  isDefault?: boolean;
}

export interface UpdateProviderInput {
  label?: string;
  baseURL?: string;
  apiKey?: string;
  defaultModel?: string;
  isDefault?: boolean;
}

export interface ProviderModel {
  id: string;
}

export interface ProviderTestConnectionResult {
  success: boolean;
  message: string;
}
