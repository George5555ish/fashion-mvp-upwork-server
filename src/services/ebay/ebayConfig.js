const SANDBOX_API_BASE = 'https://api.sandbox.ebay.com';
const PRODUCTION_API_BASE = 'https://api.ebay.com';

export function isEbayConfigured() {
  return Boolean(
    process.env.EBAY_CLIENT_ID &&
    process.env.EBAY_CLIENT_SECRET &&
    process.env.USE_EBAY_API !== 'false'
  );
}

export function getEbayConfig() {
  const env = process.env.EBAY_ENV === 'production' ? 'production' : 'sandbox';
  const apiBase = env === 'production' ? PRODUCTION_API_BASE : SANDBOX_API_BASE;

  return {
    clientId: process.env.EBAY_CLIENT_ID,
    clientSecret: process.env.EBAY_CLIENT_SECRET,
    apiBase,
    marketplaceId: process.env.EBAY_MARKETPLACE || 'EBAY_US',
    campaignId: process.env.EBAY_CAMPAIGN_ID || '',
    env,
  };
}
