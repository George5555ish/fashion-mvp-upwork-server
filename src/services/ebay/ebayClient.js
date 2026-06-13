import { getEbayAccessToken, getEbayAuthorizationHeader, clearEbayTokenCache } from './ebayAuth.js';
import { getEbayConfig } from './ebayConfig.js';
import { logEbay } from './ebayLogger.js';

/**
 * Authenticated GET request to eBay Browse/Buy API.
 * All server-side eBay API calls should go through this helper.
 */
export async function ebayApiGet(path, searchParams = {}, retryOnUnauthorized = true) {
  const { apiBase, marketplaceId } = getEbayConfig();
  const authorization = await getEbayAuthorizationHeader();

  const query = searchParams instanceof URLSearchParams
    ? searchParams
    : new URLSearchParams(searchParams);

  const url = `${apiBase}${path}${query.toString() ? `?${query.toString()}` : ''}`;

  logEbay('API GET', { url, marketplaceId });

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      'X-EBAY-C-MARKETPLACE-ID': marketplaceId,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401 && retryOnUnauthorized) {
    logEbay('API returned 401 — clearing token cache and retrying once');
    clearEbayTokenCache();
    await getEbayAccessToken();
    return ebayApiGet(path, searchParams, false);
  }

  if (!response.ok) {
    logEbay('API GET failed', { status: response.status, path });
  } else {
    logEbay('API GET succeeded', { status: response.status, path });
  }

  return response;
}

/**
 * Public listing URL for users (not the authenticated itemHref API URL)
 */
export function resolveEbayShopUrl(itemSummary) {
  const webUrl = itemSummary.itemWebUrl;
  if (webUrl && !isEbayApiUrl(webUrl)) {
    return webUrl;
  }

  const legacyId = itemSummary.legacyItemId;
  if (!legacyId) {
    return null;
  }

  const { env } = getEbayConfig();
  const siteBase = env === 'production' ? 'https://www.ebay.com' : 'https://sandbox.ebay.com';
  return `${siteBase}/itm/${legacyId}`;
}

function isEbayApiUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes('api.ebay.com') || hostname.includes('api.sandbox.ebay.com');
  } catch {
    return true;
  }
}

export { isEbayApiUrl };
