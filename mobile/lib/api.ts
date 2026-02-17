import { createApiClient, getApiBaseUrl } from '../../shared/index.js';

let accessToken = process.env.EXPO_PUBLIC_ACCESS_TOKEN || '';

export function setMobileAccessToken(nextToken: string) {
  accessToken = String(nextToken || '').trim();
}

export function getMobileAccessToken() {
  return accessToken || null;
}

export function hasMobileAccessToken() {
  return Boolean(accessToken);
}

export const mobileApiBaseUrl = getApiBaseUrl({
  env: process.env as Record<string, string | undefined>,
});

export const mobileApiClient = createApiClient({
  getAccessToken: () => getMobileAccessToken(),
  envOptions: {
    env: process.env as Record<string, string | undefined>,
  },
});
