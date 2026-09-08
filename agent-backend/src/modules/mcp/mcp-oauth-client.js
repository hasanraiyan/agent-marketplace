import crypto from 'crypto';
import {
  discoverOAuthServerInfo,
  registerClient,
  exchangeAuthorization,
  refreshAuthorization,
} from '@modelcontextprotocol/sdk/client/auth.js';

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

// Thin wrappers around the official MCP SDK's client OAuth module
// (@modelcontextprotocol/sdk/client/auth.js) instead of a hand-rolled
// implementation. That module already handles what our old version got
// wrong or missed entirely: RFC 8707 `resource` binding, correct
// client-auth-method selection at the token endpoint (HTTP Basic vs POST
// body vs public, per RFC 8414's token_endpoint_auth_methods_supported —
// our old code always sent the secret in the POST body, never Basic auth),
// OIDC-fallback discovery, and structured OAuth error parsing. Exported
// function names/shapes are kept identical to the old module so
// mcp.service.js/mcp-token.service.js barely change.

/**
 * Dynamic Client Registration (RFC 7591), delegated to the SDK's
 * `registerClient`. Tries confidential-client registration first
 * (client_secret_basic). If the server doesn't return a secret, re-registers
 * as a public client (none) so the token exchange skips client_secret.
 */
export async function dynamicClientRegistration({
  registrationEndpoint,
  redirectUris,
  clientName,
  clientUri,
  scopes,
}) {
  const metadata = { registration_endpoint: registrationEndpoint };
  const scope = scopes?.length ? scopes.join(' ') : undefined;

  const tryRegister = (tokenEndpointAuthMethod) =>
    registerClient(registrationEndpoint, {
      metadata,
      clientMetadata: {
        redirect_uris: redirectUris,
        client_name: clientName,
        client_uri: clientUri,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: tokenEndpointAuthMethod,
      },
      scope,
    });

  // Try confidential client first
  const data = await tryRegister('client_secret_basic');
  if (data.client_secret) {
    return {
      clientId: data.client_id,
      clientSecret: data.client_secret,
      clientSecretExpiresAt: data.client_secret_expires_at || 0,
      tokenEndpointAuthMethod: 'client_secret_basic',
    };
  }

  // No secret returned — re-register as a public client so the auth server
  // knows not to expect client_secret on token exchanges.
  const publicData = await tryRegister('none');

  return {
    clientId: publicData.client_id,
    clientSecret: null,
    clientSecretExpiresAt: 0,
    tokenEndpointAuthMethod: 'none',
  };
}

/**
 * Discovers the OAuth authorization/token endpoints for a remote MCP server,
 * delegated to the SDK's `discoverOAuthServerInfo` (RFC 9728 protected
 * resource metadata, then RFC 8414 authorization server metadata with an
 * OpenID Connect Discovery fallback our old hand-rolled version didn't have).
 */
export async function discoverOAuthEndpoints(mcpServerUrl) {
  const { authorizationServerMetadata: metadata } = await discoverOAuthServerInfo(mcpServerUrl);

  if (!metadata?.authorization_endpoint || !metadata?.token_endpoint) {
    throw new Error('Authorization server metadata is missing required endpoints');
  }

  return {
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    registrationEndpoint: metadata.registration_endpoint || null,
    scopesSupported: metadata.scopes_supported || [],
  };
}

export function generatePkcePair() {
  const codeVerifier = toBase64Url(crypto.randomBytes(32));
  const codeChallenge = toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizationUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  codeChallenge,
  state,
  scopes = [],
  resource,
}) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  if (scopes.length > 0) {
    url.searchParams.set('scope', scopes.join(' '));
  }
  // RFC 8707 Resource Indicators, required by the MCP Authorization spec
  // (2025-06-18): binds the issued token to this specific MCP server so a
  // multi-tenant authorization server (Clerk, Context7, etc.) can audience-
  // scope it correctly. Reference MCP clients (Claude) send this.
  if (resource) {
    url.searchParams.set('resource', resource);
  }
  return url.toString();
}

// clientInformation shape the SDK's token functions expect. `client_secret`
// must be `undefined` (not `null`) when absent — the SDK's auth-method
// selection checks `client_secret !== undefined`, and our DB-decrypted
// "no secret" value is `null`. `token_endpoint_auth_method`, when it matches
// one we captured at registration time, makes the SDK pick that method
// directly instead of guessing from `token_endpoint_auth_methods_supported`
// (which we don't persist).
function toClientInformation({ clientId, clientSecret, tokenEndpointAuthMethod }) {
  return {
    client_id: clientId,
    client_secret: clientSecret || undefined,
    ...(tokenEndpointAuthMethod ? { token_endpoint_auth_method: tokenEndpointAuthMethod } : {}),
  };
}

export async function exchangeCodeForToken({
  tokenEndpoint,
  clientId,
  clientSecret,
  code,
  redirectUri,
  codeVerifier,
  resource,
  tokenEndpointAuthMethod,
}) {
  return exchangeAuthorization(tokenEndpoint, {
    metadata: { token_endpoint: tokenEndpoint },
    clientInformation: toClientInformation({ clientId, clientSecret, tokenEndpointAuthMethod }),
    authorizationCode: code,
    codeVerifier,
    redirectUri,
    // Must match the `resource` sent at the authorize step.
    resource: resource ? new URL(resource) : undefined,
  });
}

export async function refreshAccessToken({
  tokenEndpoint,
  clientId,
  clientSecret,
  refreshToken,
  resource,
  tokenEndpointAuthMethod,
}) {
  return refreshAuthorization(tokenEndpoint, {
    metadata: { token_endpoint: tokenEndpoint },
    clientInformation: toClientInformation({ clientId, clientSecret, tokenEndpointAuthMethod }),
    refreshToken,
    resource: resource ? new URL(resource) : undefined,
  });
}
