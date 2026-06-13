/**
 * Append EPN campaign tracking to eBay item URLs when configured
 */
export function buildAffiliateUrl(itemWebUrl, campaignId) {
  if (!itemWebUrl || !campaignId) {
    return itemWebUrl;
  }

  try {
    const url = new URL(itemWebUrl);
    url.searchParams.set('mkcid', '1');
    url.searchParams.set('campid', campaignId);
    url.searchParams.set('toolid', '10001');
    url.searchParams.set('customid', 'outfind');
    return url.toString();
  } catch {
    return itemWebUrl;
  }
}
