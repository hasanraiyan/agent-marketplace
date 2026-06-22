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
 * Discovers the OAuth authorization/token endpoints for a remote MCP server,
 * following RFC 9728 (protected resource metadata) then RFC 8414
 * (authorization server metadata) - the same two-hop discovery used by
 * Coursify's own MCP server.
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
  return postForm(tokenEndpoint, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });
}

export async function refreshAccessToken({ tokenEndpoint, clientId, clientSecret, refreshToken }) {
  return postForm(tokenEndpoint, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}
