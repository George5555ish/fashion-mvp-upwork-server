import dotenv from 'dotenv';

dotenv.config();

export function isSerpApiConfigured() {
  return Boolean(
    process.env.SERPAPI_KEY &&
    process.env.USE_SERPAPI !== 'false'
  );
}

export function getSerpApiConfig() {
  return {
    apiKey: process.env.SERPAPI_KEY,
    gl: process.env.SERPAPI_GL || 'us',
    hl: process.env.SERPAPI_HL || 'en',
    googleDomain: process.env.SERPAPI_GOOGLE_DOMAIN || 'google.com',
  };
}
