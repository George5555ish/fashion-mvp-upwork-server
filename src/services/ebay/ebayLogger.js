const PREFIX = '[eBay]';

export function logEbay(message, details) {
  if (details !== undefined) {
    console.log(PREFIX, message, details);
    return;
  }
  console.log(PREFIX, message);
}

export function logEbayError(message, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(PREFIX, message, detail);
}

export function logEbayConfigStatus() {
  const configured = Boolean(
    process.env.EBAY_CLIENT_ID &&
    process.env.EBAY_CLIENT_SECRET &&
    process.env.USE_EBAY_API !== 'false'
  );

  if (!configured) {
    logEbay('Not configured — product search will use seed DB only', {
      hasClientId: Boolean(process.env.EBAY_CLIENT_ID),
      hasClientSecret: Boolean(process.env.EBAY_CLIENT_SECRET),
      useEbayApi: process.env.USE_EBAY_API ?? '(unset, defaults to enabled when keys present)',
    });
    return;
  }

  logEbay('Configured for product search', {
    env: process.env.EBAY_ENV === 'production' ? 'production' : 'sandbox',
    marketplace: process.env.EBAY_MARKETPLACE || 'EBAY_US',
    hasCampaignId: Boolean(process.env.EBAY_CAMPAIGN_ID),
  });
}
