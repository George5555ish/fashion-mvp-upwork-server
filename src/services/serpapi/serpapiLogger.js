import { isSerpApiConfigured } from './serpapiConfig.js';

const PREFIX = '[SerpAPI]';

export function logSerpApi(message, details) {
  if (details !== undefined) {
    console.log(PREFIX, message, details);
    return;
  }
  console.log(PREFIX, message);
}

export function logSerpApiError(message, error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(PREFIX, message, detail);
}

export function logSerpApiConfigStatus() {
  if (!isSerpApiConfigured()) {
    logSerpApi('Not configured — Google Shopping search disabled', {
      hasApiKey: Boolean(process.env.SERPAPI_KEY),
      useSerpApi: process.env.USE_SERPAPI ?? '(unset, defaults to enabled when key present)',
    });
    return;
  }

  logSerpApi('Configured for Google Shopping search', {
    gl: process.env.SERPAPI_GL || 'us',
    hl: process.env.SERPAPI_HL || 'en',
    googleDomain: process.env.SERPAPI_GOOGLE_DOMAIN || 'google.com',
  });
}
