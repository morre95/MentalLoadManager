import { useSyncExternalStore } from 'react';

type AuthListener = () => void;

let accessToken = (process.env.EXPO_PUBLIC_ACCESS_TOKEN || '').trim();
let refreshToken = (process.env.EXPO_PUBLIC_REFRESH_TOKEN || '').trim();
const listeners = new Set<AuthListener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getAccessToken() {
  return accessToken || null;
}

export function getRefreshToken() {
  return refreshToken || null;
}

export function setAccessToken(nextToken: string) {
  accessToken = String(nextToken || '').trim();
  emit();
}

export function setRefreshToken(nextToken: string) {
  refreshToken = String(nextToken || '').trim();
  emit();
}

export function setAuthTokens(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}) {
  if (typeof tokens?.accessToken === 'string') {
    accessToken = tokens.accessToken.trim();
  }
  if (typeof tokens?.refreshToken === 'string') {
    refreshToken = tokens.refreshToken.trim();
  }
  emit();
}

export function clearAccessToken() {
  accessToken = '';
  refreshToken = '';
  emit();
}

export function hasAccessToken() {
  return Boolean(accessToken);
}

export function subscribeToAuth(listener: AuthListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthToken() {
  return useSyncExternalStore(subscribeToAuth, getAccessToken, getAccessToken);
}
