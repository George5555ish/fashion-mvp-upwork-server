import { getEbayConfig } from './ebayConfig.js';
import { logEbay } from './ebayLogger.js';

/** @type {{ accessToken: string, tokenType: string, expiresIn: number, expiresAt: number } | null} */
let cachedToken = null;

const REFRESH_BUFFER_MS = 60_000;

/**
 * @typedef {Object} EbayTokenResponse
 * @property {string} access_token
 * @property {number} expires_in
 * @property {string} [token_type]
 */

/**
 * Cache token using expires_in from eBay OAuth response
 * @param {EbayTokenResponse} data
 */
export function cacheEbayToken(data) {
  const expiresIn = Number(data.expires_in) || 7200;
  cachedToken = {
    accessToken: data.access_token,
    tokenType: data.token_type || 'Application Access Token',
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

export function getCachedEbayToken() {
  if (!cachedToken) {
    return null;
  }

  const remainingMs = cachedToken.expiresAt - Date.now();
  return {
    ...cachedToken,
    remainingMs,
    isValid: remainingMs > REFRESH_BUFFER_MS,
  };
}

export function clearEbayTokenCache() {
  cachedToken = null;
}

/**
 * Get OAuth application access token (client credentials grant)
 */
export async function getEbayAccessToken() {
  const cached = getCachedEbayToken();
  if (cached?.isValid) {
    logEbay('Using cached access token', {
      expiresInSec: Math.round(cached.remainingMs / 1000),
      tokenType: cached.tokenType,
    });
    return cached.accessToken;
  }

  if (cached) {
    logEbay('Access token expired or near expiry — refreshing');
  } else {
    logEbay('Fetching new access token');
  }

  const { clientId, clientSecret, apiBase, env } = getEbayConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`eBay OAuth failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  cacheEbayToken(data);

  logEbay('Access token obtained', {
    env,
    expiresInSec: data.expires_in,
    tokenType: data.token_type || 'Application Access Token',
  });

  return cachedToken.accessToken;
}

/**
 * Authorization header value for eBay API requests
 */
export async function getEbayAuthorizationHeader() {
  const token = await getEbayAccessToken();
  return `Bearer ${token}`;
}
