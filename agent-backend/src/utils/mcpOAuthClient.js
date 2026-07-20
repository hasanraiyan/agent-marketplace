import crypto from 'crypto';

function toBase64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}

/**
 * Dynamic Client Registration (RFC 7591).
 * Posts client metadata to the authorization server's registration endpoint
 * and returns the issued client_id and (optionally) client_secret.
 *
 * Tries confidential-client registration first (client_secret_basic). If the
 * server doesn't return a secret, re-registers as a public client (none) so
 * the token exchange skips client_secret.
 */
export async function dynamicClientRegistration({
  registrationEndpoint,
  redirectUris,
  clientName,
  clientUri,
}) {
  async function tryRegister(authMethod) {
    const body = {
      redirect_uris: redirectUris,
      client_name: clientName,
      client_uri: clientUri,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: authMethod,
    };

    const res = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error_description ||
          data.error ||
          `Dynamic client registration failed with status ${res.status}`
      );
    }

    return data;
  }

  // Try confidential client first
  const data = await tryRegister('client_secret_basic');
  const hasSecret = Boolean(data.client_secret);

  if (hasSecret) {
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
 * following RFC 9728 (protected resource metadata) then RFC 8414
 * (authorization server metadata).
 */
export async function discoverOAuthEndpoints(mcpServerUrl) {
  const parsed = new URL(mcpServerUrl);
  const origin = parsed.origin;
  const resourcePath = parsed.pathname.replace(/^\/+/, '');

  let authorizationServers = [];
  try {
    const resourceMetadata = await fetchJson(
      `${origin}/.well-known/oauth-protected-resource/${resourcePath}`
    );
    authorizationServers = resourceMetadata.authorization_servers || [];
  } catch {
    // Some servers don't publish per-path resource metadata; fall back to
    // the origin's authorization-server metadata directly below.
  }

  const asUrl = authorizationServers[0]
    ? `${authorizationServers[0].replace(/\/+$/, '')}/.well-known/oauth-authorization-server`
    : `${origin}/.well-known/oauth-authorization-server`;

  const asMetadata = await fetchJson(asUrl);

  if (!asMetadata.authorization_endpoint || !asMetadata.token_endpoint) {
    throw new Error('Authorization server metadata is missing required endpoints');
  }

  return {
    authorizationEndpoint: asMetadata.authorization_endpoint,
    tokenEndpoint: asMetadata.token_endpoint,
    registrationEndpoint: asMetadata.registration_endpoint || null,
    scopesSupported: asMetadata.scopes_supported || [],
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
  return url.toString();
}

async function postForm(tokenEndpoint, params) {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      body.error_description || body.error || `Token request failed with status ${res.status}`
    );
  }

  return body;
}

export async function exchangeCodeForToken({
  tokenEndpoint,
  clientId,
  clientSecret,
  code,
  redirectUri,
  codeVerifier,
}) {
  const params = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  };

  // Only include client_secret for confidential clients
  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  return postForm(tokenEndpoint, params);
}

export async function refreshAccessToken({ tokenEndpoint, clientId, clientSecret, refreshToken }) {
  const params = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  };

  // Only include client_secret for confidential clients
  if (clientSecret) {
    params.client_secret = clientSecret;
  }

  return postForm(tokenEndpoint, params);
}
