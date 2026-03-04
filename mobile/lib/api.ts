import { Platform } from 'react-native';
import { createApiClient } from '../../shared/index.js';
import { clearAccessToken, getAccessToken, getRefreshToken, setAuthTokens } from '@/lib/auth';

function resolveMobileApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) {
    return String(envUrl).replace(/\/$/, '');
  }

  // Android emulator cannot reach host machine via localhost.
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://localhost:8000';
}

export const mobileApiBaseUrl = resolveMobileApiBaseUrl();

export const mobileApiClient = createApiClient({
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
  onUnauthorized: clearAccessToken,
  envOptions: {
    env: {
      API_BASE_URL: mobileApiBaseUrl,
    },
  },
});
